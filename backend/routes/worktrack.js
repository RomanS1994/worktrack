import { getAuthContext, requireEmployee } from '../auth/context.js';
import { runStoreRead, runStoreTransaction } from '../db/store.js';
import { readJsonBody, sendJson } from '../lib/http.js';
import { getManagerDashboard } from '../services/manager-dashboard.js';
import { notifyManagersAboutSubmission } from '../services/notifications.js';
import {
  createEmployeeWorkEntry,
  createProject,
  deactivateProject,
  deleteEmployeeWorkEntry,
  getCompanySettings,
  getEmployeeDashboardSummary,
  getEmployeeWeek,
  listProjects,
  submitEmployeeWeek,
  updateCompanySettings,
  updateEmployeeWorkEntry,
  updateProject,
} from '../services/worktrack.js';

async function getAuthenticatedContext(request, response) {
  const context = await getAuthContext(request, response);
  return context || null;
}

function normalizeClockTime(value) {
  const text = String(value ?? '').trim();
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  if (!match) throw new Error('Invalid work time');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error('Invalid work time');
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function shiftDetailsFromPayload(payload = {}) {
  const hasStart = Object.prototype.hasOwnProperty.call(payload, 'startTime');
  const hasEnd = Object.prototype.hasOwnProperty.call(payload, 'endTime');
  const hasNote = Object.prototype.hasOwnProperty.call(payload, 'note');
  if (!hasStart && !hasEnd && !hasNote) return null;
  if (hasStart !== hasEnd) throw new Error('Start and end time are required');

  const note = hasNote ? String(payload.note ?? '').trim().slice(0, 1200) : undefined;
  if (!hasStart) return { note };

  const startTime = normalizeClockTime(payload.startTime);
  const endTime = normalizeClockTime(payload.endTime);
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end <= start) end += 24 * 60;
  const minutes = end - start;
  if (minutes <= 0 || minutes > 24 * 60) throw new Error('Invalid work time range');
  return {
    startTime,
    endTime,
    note: note ?? '',
    hours: (minutes / 60).toFixed(2),
  };
}

async function enrichWorkEntries(client, payload) {
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];
  if (!entries.length) return payload;
  const details = await client.workEntry.findMany({
    where: { id: { in: entries.map(entry => entry.id) } },
    select: { id: true, startTime: true, endTime: true, note: true },
  });
  const byId = new Map(details.map(item => [item.id, item]));
  return {
    ...payload,
    entries: entries.map(entry => ({ ...entry, ...(byId.get(entry.id) || {}) })),
  };
}

export async function handleWorkTrackRoutes(request, response, { pathName, url }) {
  if (request.method === 'GET' && pathName === '/api/projects') {
    const context = await getAuthenticatedContext(request, response);
    if (!context) return true;
    const payload = await runStoreRead({ prisma: client => listProjects(client, context) });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/projects') {
    const context = await getAuthenticatedContext(request, response);
    if (!context) return true;
    const body = await readJsonBody(request);
    const project = await runStoreTransaction({ prisma: client => createProject(client, context, body) });
    sendJson(response, 201, { project });
    return true;
  }

  const projectMatch = pathName.match(/^\/api\/projects\/([^/]+)$/);
  if (request.method === 'PATCH' && projectMatch) {
    const context = await getAuthenticatedContext(request, response);
    if (!context) return true;
    const body = await readJsonBody(request);
    const project = await runStoreTransaction({ prisma: client => updateProject(client, context, projectMatch[1], body) });
    sendJson(response, 200, { project });
    return true;
  }

  const deactivateProjectMatch = pathName.match(/^\/api\/projects\/([^/]+)\/deactivate$/);
  if (request.method === 'POST' && deactivateProjectMatch) {
    const context = await getAuthenticatedContext(request, response);
    if (!context) return true;
    const project = await runStoreTransaction({ prisma: client => deactivateProject(client, context, deactivateProjectMatch[1]) });
    sendJson(response, 200, { project });
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/company-settings') {
    const context = await getAuthenticatedContext(request, response);
    if (!context) return true;
    const payload = await runStoreRead({ prisma: client => getCompanySettings(client, context) });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'PATCH' && pathName === '/api/company-settings') {
    const context = await getAuthenticatedContext(request, response);
    if (!context) return true;
    const body = await readJsonBody(request);
    const payload = await runStoreTransaction({ prisma: client => updateCompanySettings(client, context, body) });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/work-entries') {
    const context = await requireEmployee(request, response);
    if (!context) return true;
    const payload = await runStoreRead({
      prisma: async client => enrichWorkEntries(client, await getEmployeeWeek(client, context, url.searchParams.get('weekStart'))),
    });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/work-entries') {
    const context = await requireEmployee(request, response);
    if (!context) return true;
    const body = await readJsonBody(request);
    const shift = shiftDetailsFromPayload(body);
    const entry = await runStoreTransaction({
      prisma: async client => {
        const created = await createEmployeeWorkEntry(client, context, shift?.hours ? { ...body, hours: shift.hours } : body);
        if (!shift) return created;
        const updated = await client.workEntry.update({
          where: { id: created.id },
          data: {
            ...(shift.startTime ? { startTime: shift.startTime, endTime: shift.endTime } : {}),
            ...(shift.note !== undefined ? { note: shift.note || null } : {}),
          },
          select: { startTime: true, endTime: true, note: true },
        });
        return { ...created, ...updated };
      },
    });
    sendJson(response, 201, { entry });
    return true;
  }

  const workEntryMatch = pathName.match(/^\/api\/work-entries\/([^/]+)$/);
  if (request.method === 'PATCH' && workEntryMatch) {
    const context = await requireEmployee(request, response);
    if (!context) return true;
    const body = await readJsonBody(request);
    const shift = shiftDetailsFromPayload(body);
    const entry = await runStoreTransaction({
      prisma: async client => {
        const updatedEntry = await updateEmployeeWorkEntry(client, context, workEntryMatch[1], shift?.hours ? { ...body, hours: shift.hours } : body);
        if (!shift) return updatedEntry;
        const details = await client.workEntry.update({
          where: { id: updatedEntry.id },
          data: {
            ...(shift.startTime ? { startTime: shift.startTime, endTime: shift.endTime } : {}),
            ...(shift.note !== undefined ? { note: shift.note || null } : {}),
          },
          select: { startTime: true, endTime: true, note: true },
        });
        return { ...updatedEntry, ...details };
      },
    });
    sendJson(response, 200, { entry });
    return true;
  }

  if (request.method === 'DELETE' && workEntryMatch) {
    const context = await requireEmployee(request, response);
    if (!context) return true;
    const payload = await runStoreTransaction({ prisma: client => deleteEmployeeWorkEntry(client, context, workEntryMatch[1]) });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/weekly-submissions') {
    const context = await requireEmployee(request, response);
    if (!context) return true;
    const body = await readJsonBody(request);
    const submission = await runStoreTransaction({
      prisma: async client => {
        const createdSubmission = await submitEmployeeWeek(client, context, body);
        await notifyManagersAboutSubmission(client, context, createdSubmission);
        return createdSubmission;
      },
    });
    sendJson(response, 201, { submission });
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/work-summary') {
    const context = await getAuthenticatedContext(request, response);
    if (!context) return true;
    const payload = await runStoreRead({
      prisma: client => context.activeMembership?.role === 'MANAGER'
        ? getManagerDashboard(client, context)
        : getEmployeeDashboardSummary(client, context, url.searchParams.get('weekStart')),
    });
    const responsePayload = context.activeMembership?.role === 'EMPLOYEE'
      ? {
          ...payload,
          hourlyRateCzk: context.activeMembership.hourlyRateCzk == null ? '0.00' : String(context.activeMembership.hourlyRateCzk),
        }
      : payload;
    sendJson(response, 200, responsePayload);
    return true;
  }

  return false;
}
