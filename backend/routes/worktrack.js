import { getAuthContext, requireEmployee } from '../auth/context.js';
import { runStoreRead, runStoreTransaction } from '../db/store.js';
import { readJsonBody, sendJson } from '../lib/http.js';
import { getManagerDashboard } from '../services/manager-dashboard.js';
import { notifyManagersAboutSubmission } from '../services/notifications.js';
import { calculateDailyOvertime, calculateNetWorkSummary } from '../services/work-time-calculation.js';
import {
  createEmployeeWorkEntry,
  createProject,
  deactivateProject,
  deleteEmployeeWorkEntry,
  getCompanySettings,
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
  const grossMinutes = end - start;
  if (grossMinutes <= 0 || grossMinutes > 24 * 60) throw new Error('Invalid work time range');
  return {
    startTime,
    endTime,
    note: note ?? '',
    grossMinutes,
    grossHours: (grossMinutes / 60).toFixed(2),
  };
}

async function applyWorkRules(client, context, shift) {
  if (!shift?.grossMinutes) return shift;
  const company = await client.company.findUnique({
    where: { id: context.activeMembership.companyId },
    select: { breakMinutes: true },
  });
  const configuredBreak = Number(company?.breakMinutes || 0);
  const breakMinutes = shift.grossMinutes > configuredBreak ? configuredBreak : 0;
  const netMinutes = shift.grossMinutes - breakMinutes;
  if (netMinutes <= 0) throw new Error('Work time must be longer than the automatic break');
  return {
    ...shift,
    breakMinutes,
    netHours: (netMinutes / 60).toFixed(2),
  };
}

async function enrichWorkEntries(client, payload) {
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];
  if (!entries.length) return payload;
  const details = await client.workEntry.findMany({
    where: { id: { in: entries.map(entry => entry.id) } },
    select: { id: true, startTime: true, endTime: true, note: true, grossHours: true, breakMinutes: true },
  });
  const byId = new Map(details.map(item => [item.id, item]));
  return {
    ...payload,
    entries: entries.map(entry => ({
      ...entry,
      ...(byId.get(entry.id) || {}),
      grossHours: byId.get(entry.id)?.grossHours == null ? entry.hours : String(byId.get(entry.id).grossHours),
      breakMinutes: Number(byId.get(entry.id)?.breakMinutes || 0),
    })),
  };
}

async function getEmployeeWeeklySummary(client, context, weekStart) {
  const [weekPayload, companyRules] = await Promise.all([
    enrichWorkEntries(client, await getEmployeeWeek(client, context, weekStart)),
    client.company.findUnique({
      where: { id: context.activeMembership.companyId },
      select: { breakMinutes: true, standardDailyHours: true },
    }),
  ]);
  const rules = {
    breakMinutes: Number(companyRules?.breakMinutes || 0),
    standardDailyHours: Number(companyRules?.standardDailyHours || 8),
  };
  const hourlyRateCzk = context.activeMembership.hourlyRateCzk == null ? '0.00' : String(context.activeMembership.hourlyRateCzk);
  const summary = calculateNetWorkSummary(weekPayload.entries, hourlyRateCzk, rules);
  return {
    role: 'EMPLOYEE',
    company: context.activeCompany || context.activeMembership.company || null,
    week: weekPayload.week,
    submission: weekPayload.submission,
    summary: {
      ...summary,
      overtimeHours: calculateDailyOvertime(weekPayload.entries, rules),
    },
    workRules: {
      breakMinutes: rules.breakMinutes,
      standardDailyHours: rules.standardDailyHours.toFixed(2),
    },
    hourlyRateCzk,
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
        const ruledShift = await applyWorkRules(client, context, shift);
        const created = await createEmployeeWorkEntry(client, context, ruledShift?.netHours ? { ...body, hours: ruledShift.netHours } : body);
        if (!ruledShift) return created;
        const updated = await client.workEntry.update({
          where: { id: created.id },
          data: {
            ...(ruledShift.startTime ? {
              startTime: ruledShift.startTime,
              endTime: ruledShift.endTime,
              grossHours: ruledShift.grossHours,
              breakMinutes: ruledShift.breakMinutes,
            } : {}),
            ...(ruledShift.note !== undefined ? { note: ruledShift.note || null } : {}),
          },
          select: { startTime: true, endTime: true, note: true, grossHours: true, breakMinutes: true },
        });
        return { ...created, ...updated, grossHours: updated.grossHours == null ? created.hours : String(updated.grossHours) };
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
        const ruledShift = await applyWorkRules(client, context, shift);
        const updatedEntry = await updateEmployeeWorkEntry(client, context, workEntryMatch[1], ruledShift?.netHours ? { ...body, hours: ruledShift.netHours } : body);
        if (!ruledShift) return updatedEntry;
        const details = await client.workEntry.update({
          where: { id: updatedEntry.id },
          data: {
            ...(ruledShift.startTime ? {
              startTime: ruledShift.startTime,
              endTime: ruledShift.endTime,
              grossHours: ruledShift.grossHours,
              breakMinutes: ruledShift.breakMinutes,
            } : {}),
            ...(ruledShift.note !== undefined ? { note: ruledShift.note || null } : {}),
          },
          select: { startTime: true, endTime: true, note: true, grossHours: true, breakMinutes: true },
        });
        return { ...updatedEntry, ...details, grossHours: details.grossHours == null ? updatedEntry.hours : String(details.grossHours) };
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
        : getEmployeeWeeklySummary(client, context, url.searchParams.get('weekStart')),
    });
    sendJson(response, 200, payload);
    return true;
  }

  return false;
}
