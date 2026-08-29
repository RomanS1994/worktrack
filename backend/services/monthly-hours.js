import { calculateNetWorkEntries, calculateNetWorkSummary } from './work-time-calculation.js';

function normalizeMonth(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) throw new Error('Invalid month');
  const [year, month] = raw.split('-').map(Number);
  if (month < 1 || month > 12) throw new Error('Invalid month');
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { key: raw, start, end };
}

export async function getEmployeeMonthlyHours(client, context, monthInput) {
  const membership = context?.activeMembership;
  if (!membership || membership.role !== 'EMPLOYEE' || membership.status !== 'ACTIVE') {
    throw new Error('Employee access is required');
  }

  const today = new Date();
  const defaultMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  const month = normalizeMonth(monthInput || defaultMonth);

  const [entries, companyRules] = await Promise.all([
    client.workEntry.findMany({
      where: {
        companyId: membership.companyId,
        employeeMembershipId: membership.id,
        workDate: { gte: month.start, lt: month.end },
      },
      include: { project: true },
      orderBy: [{ workDate: 'asc' }, { createdAt: 'asc' }],
    }),
    client.company.findUnique({
      where: { id: membership.companyId },
      select: { breakMinutes: true, standardDailyHours: true },
    }),
  ]);

  const rules = {
    breakMinutes: Number(companyRules?.breakMinutes || 0),
    standardDailyHours: Number(companyRules?.standardDailyHours || 8),
  };
  const normalizedEntries = calculateNetWorkEntries(entries, rules);
  const rows = normalizedEntries.map(entry => ({
    id: entry.id,
    date: entry.workDate.toISOString().slice(0, 10),
    projectId: entry.projectId,
    project: entry.project?.name || '',
    hours: entry.netHours,
    status: entry.status,
  }));
  const summary = calculateNetWorkSummary(entries, membership.hourlyRateCzk || 0, rules);

  return {
    month: month.key,
    rows,
    workRules: {
      breakMinutes: rules.breakMinutes,
      standardDailyHours: rules.standardDailyHours.toFixed(2),
    },
    summary: {
      totalHours: summary.totalHours,
      approvedHours: summary.approvedHours,
      pendingHours: summary.pendingHours,
      approvedAmountCzk: summary.confirmedSalaryCzk,
      pendingAmountCzk: summary.predictedSalaryCzk,
    },
  };
}
