import { getAuthContext, requireManager } from '../auth/context.js';
import { runStoreRead, runStoreTransaction } from '../db/store.js';
import { readJsonBody, sendJson } from '../lib/http.js';

const BREAK_OPTIONS = new Set([0, 30, 60]);

function serializeRules(company) {
  return {
    breakMinutes: Number(company?.breakMinutes || 0),
    standardDailyHours: Number(company?.standardDailyHours || 8).toFixed(2),
  };
}

function normalizeRules(body = {}) {
  const breakMinutes = Number.parseInt(body.breakMinutes, 10);
  const standardDailyHours = Number(String(body.standardDailyHours ?? '').replace(',', '.'));

  if (!BREAK_OPTIONS.has(breakMinutes)) {
    throw new Error('Break must be 0, 30 or 60 minutes');
  }

  if (!Number.isFinite(standardDailyHours) || standardDailyHours <= 0 || standardDailyHours > 24) {
    throw new Error('Standard daily hours must be between 0 and 24');
  }

  return {
    breakMinutes,
    standardDailyHours: standardDailyHours.toFixed(2),
  };
}

export async function handleWorkRulesRoutes(request, response, { pathName }) {
  if (pathName !== '/api/work-rules') return false;

  if (request.method === 'GET') {
    const context = await getAuthContext(request, response);
    if (!context) return true;
    const company = await runStoreRead({
      prisma: client => client.company.findUnique({
        where: { id: context.activeMembership.companyId },
        select: { breakMinutes: true, standardDailyHours: true },
      }),
    });
    if (!company) throw new Error('Company not found');
    sendJson(response, 200, { workRules: serializeRules(company) });
    return true;
  }

  if (request.method === 'PATCH') {
    const context = await requireManager(request, response);
    if (!context) return true;
    const rules = normalizeRules(await readJsonBody(request));
    const company = await runStoreTransaction({
      prisma: client => client.company.update({
        where: { id: context.activeMembership.companyId },
        data: rules,
        select: { breakMinutes: true, standardDailyHours: true },
      }),
    });
    sendJson(response, 200, { workRules: serializeRules(company) });
    return true;
  }

  return false;
}
