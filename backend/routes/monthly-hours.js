import { requireEmployee } from '../auth/context.js';
import { runStoreRead } from '../db/store.js';
import { sendJson } from '../lib/http.js';

function parseMonth(value) {
  const text = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})$/.exec(text);
  if (!match) throw new Error('Invalid month');
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error('Invalid month');
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end, value: `${year}-${String(month).padStart(2, '0')}` };
}

function moneyFromHours(hours, rate) {
  return Math.round(Number(hours || 0) * Number(rate || 0) * 100) / 100;
}

function numberString(value) {
  return Number(value || 0).toFixed(2);
}

export async function handleMonthlyHoursRoutes(request, response, { pathName, url }) {
  if (request.method !== 'GET' || pathName !== '/api/monthly-hours') return false;

  const context = await requireEmployee(request, response);
  if (!context) return true;

  const range = parseMonth(url.searchParams.get('month'));
  const membership = context.activeMembership;
  const rate = Number(membership?.hourlyRateCzk || 0);

  const payload = await runStoreRead({
    prisma: async client => {
      const entries = await client.workEntry.findMany({
        where: {
          companyId: membership.companyId,
          employeeMembershipId: membership.id,
          workDate: { gte: range.start, lt: range.end },
        },
        include: { project: true },
        orderBy: [{ workDate: 'asc' }, { createdAt: 'asc' }],
      });

      let totalHours = 0;
      let approvedHours = 0;
      let pendingHours = 0;

      const rows = entries.map(entry => {
        const hours = Number(entry.hours || 0);
        totalHours += hours;
        if (entry.status === 'APPROVED') approvedHours += hours;
        else if (entry.status === 'DRAFT' || entry.status === 'SUBMITTED') pendingHours += hours;

        return {
          id: entry.id,
          date: entry.workDate.toISOString().slice(0, 10),
          project: entry.project?.name || '',
          hours: numberString(hours),
          status: entry.status,
        };
      });

      return {
        month: range.value,
        rows,
        summary: {
          totalHours: numberString(totalHours),
          approvedHours: numberString(approvedHours),
          pendingHours: numberString(pendingHours),
          approvedAmountCzk: numberString(moneyFromHours(approvedHours, rate)),
          pendingAmountCzk: numberString(moneyFromHours(pendingHours, rate)),
        },
      };
    },
  });

  sendJson(response, 200, payload);
  return true;
}
