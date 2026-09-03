import { getAuthContext } from '../auth/context.js';
import { runStoreRead } from '../db/store.js';
import { sendJson } from '../lib/http.js';
import { getEmployeeWeek } from '../services/employee-work.js';
import { getManagerDashboard } from '../services/manager-dashboard.js';
import {
  calculateDailyOvertime,
  calculateNetWorkEntries,
  calculateNetWorkSummary,
} from '../services/work-time-calculation.js';

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

async function getEmployeeWeeklySummary(client, context, weekStart) {
  const hourlyRateCzk = context.activeMembership.hourlyRateCzk == null
    ? '0.00'
    : String(context.activeMembership.hourlyRateCzk);
  const rules = await getWorkRules(client, context);
  const weekPayload = await enrichWorkEntries(
    client,
    await getEmployeeWeek(client, context, weekStart),
    { hourlyRateCzk, rules },
  );

  return {
    role: 'EMPLOYEE',
    company: context.activeCompany || context.activeMembership.company || null,
    week: weekPayload.week,
    submission: weekPayload.submission,
    summary: {
      ...weekPayload.summary,
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
  if (request.method !== 'GET' || pathName !== '/api/work-summary') return false;

  const context = await getAuthContext(request, response);
  if (!context) return true;

  const payload = await runStoreRead({
    prisma: client => context.activeMembership?.role === 'MANAGER'
      ? getManagerDashboard(client, context)
      : getEmployeeWeeklySummary(client, context, url.searchParams.get('weekStart')),
  });
  sendJson(response, 200, payload);
  return true;
}
