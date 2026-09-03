import { requireEmployee } from '../auth/context.js';
import { runStoreRead, runStoreTransaction } from '../db/store.js';
import { readJsonBody, sendJson } from '../lib/http.js';
import {
  createEmployeeWorkEntry,
  deleteEmployeeWorkEntry,
  getEmployeeWeek,
  submitEmployeeWeek,
  updateEmployeeWorkEntry,
} from '../services/employee-work.js';
import { notifyManagersAboutSubmission } from '../services/notifications.js';
import { freezeSubmissionHourlyRateSnapshots } from '../services/submission-rate-snapshots.js';
import { calculateNetWorkEntries, calculateNetWorkSummary } from '../services/work-time-calculation.js';

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

async function getWorkRules(client, context) {
  const company = await client.company.findUnique({
    where: { id: context.activeMembership.companyId },
    select: { breakMinutes: true, standardDailyHours: true },
  });

  return {
    breakMinutes: Number(company?.breakMinutes || 0),
    standardDailyHours: Number(company?.standardDailyHours || 8),
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

async function enrichWorkEntries(client, payload, { hourlyRateCzk = '0.00', rules = {} } = {}) {
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];
  if (!entries.length) {
    return {
      ...payload,
      summary: calculateNetWorkSummary([], hourlyRateCzk, rules),
    };
  }

  const details = await client.workEntry.findMany({
    where: { id: { in: entries.map(entry => entry.id) } },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      note: true,
      grossHours: true,
      breakMinutes: true,
      hourlyRateCzk: true,
    },
  });
  const byId = new Map(details.map(item => [item.id, item]));
  const enrichedEntries = entries.map(entry => {
    const detail = byId.get(entry.id);
    return {
      ...entry,
      ...(detail || {}),
      grossHours: detail?.grossHours == null ? entry.hours : String(detail.grossHours),
      breakMinutes: Number(detail?.breakMinutes || 0),
      hourlyRateCzk: detail?.hourlyRateCzk == null ? null : String(detail.hourlyRateCzk),
    };
  });

  return {
    ...payload,
    entries: calculateNetWorkEntries(enrichedEntries, rules),
    summary: calculateNetWorkSummary(enrichedEntries, hourlyRateCzk, rules),
  };
}

export async function handleEmployeeWorkRoutes(request, response, { pathName, url }) {
  if (request.method === 'GET' && pathName === '/api/work-entries') {
    const context = await requireEmployee(request, response);
    if (!context) return true;

    const payload = await runStoreRead({
      prisma: async client => {
        const hourlyRateCzk = context.activeMembership.hourlyRateCzk == null
          ? '0.00'
          : String(context.activeMembership.hourlyRateCzk);
        const rules = await getWorkRules(client, context);
        return enrichWorkEntries(
          client,
          await getEmployeeWeek(client, context, url.searchParams.get('weekStart')),
          { hourlyRateCzk, rules },
        );
      },
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
        const created = await createEmployeeWorkEntry(
          client,
          context,
          ruledShift?.netHours ? { ...body, hours: ruledShift.netHours } : body,
        );
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
          select: {
            startTime: true,
            endTime: true,
            note: true,
            grossHours: true,
            breakMinutes: true,
            hourlyRateCzk: true,
          },
        });

        return {
          ...created,
          ...updated,
          grossHours: updated.grossHours == null ? created.hours : String(updated.grossHours),
          breakMinutes: Number(updated.breakMinutes || 0),
          hourlyRateCzk: updated.hourlyRateCzk == null ? null : String(updated.hourlyRateCzk),
          netHours: created.hours,
        };
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
        const updatedEntry = await updateEmployeeWorkEntry(
          client,
          context,
          workEntryMatch[1],
          ruledShift?.netHours ? { ...body, hours: ruledShift.netHours } : body,
        );
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
          select: {
            startTime: true,
            endTime: true,
            note: true,
            grossHours: true,
            breakMinutes: true,
            hourlyRateCzk: true,
          },
        });

        return {
          ...updatedEntry,
          ...details,
          grossHours: details.grossHours == null ? updatedEntry.hours : String(details.grossHours),
          breakMinutes: Number(details.breakMinutes || 0),
          hourlyRateCzk: details.hourlyRateCzk == null ? null : String(details.hourlyRateCzk),
          netHours: updatedEntry.hours,
        };
      },
    });
    sendJson(response, 200, { entry });
    return true;
  }

  if (request.method === 'DELETE' && workEntryMatch) {
    const context = await requireEmployee(request, response);
    if (!context) return true;

    const payload = await runStoreTransaction({
      prisma: client => deleteEmployeeWorkEntry(client, context, workEntryMatch[1]),
    });
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
        await freezeSubmissionHourlyRateSnapshots(client, context.activeMembership, createdSubmission);
        await notifyManagersAboutSubmission(client, context, createdSubmission);
        return createdSubmission;
      },
    });
    sendJson(response, 201, { submission });
    return true;
  }

  return false;
}
