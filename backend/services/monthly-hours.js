function normalizeMonth(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) throw new Error('Invalid month');
  const [year, month] = raw.split('-').map(Number);
  if (month < 1 || month > 12) throw new Error('Invalid month');
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { key: raw, start, end };
}

function money(hours, rate) {
  return (Number(hours || 0) * Number(rate || 0)).toFixed(2);
}

export async function getEmployeeMonthlyHours(client, context, monthInput) {
  const membership = context?.activeMembership;
  if (!membership || membership.role !== 'EMPLOYEE' || membership.status !== 'ACTIVE') {
    throw new Error('Employee access is required');
  }

  const today = new Date();
  const defaultMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  const month = normalizeMonth(monthInput || defaultMonth);

  const entries = await client.workEntry.findMany({
    where: {
      companyId: membership.companyId,
      employeeMembershipId: membership.id,
      workDate: { gte: month.start, lt: month.end },
    },
    include: { project: true },
    orderBy: [{ workDate: 'asc' }, { createdAt: 'asc' }],
  });

  const rows = entries.map(entry => ({
    id: entry.id,
    date: entry.workDate.toISOString().slice(0, 10),
    projectId: entry.projectId,
    project: entry.project?.name || '',
    hours: Number(entry.hours).toFixed(2),
    status: entry.status,
  }));

  const totalHours = rows.reduce((sum, row) => sum + Number(row.hours), 0);
  const approvedHours = rows.filter(row => row.status === 'APPROVED').reduce((sum, row) => sum + Number(row.hours), 0);
  const pendingHours = rows.filter(row => ['DRAFT', 'SUBMITTED'].includes(row.status)).reduce((sum, row) => sum + Number(row.hours), 0);
  const rate = Number(membership.hourlyRateCzk || 0);

  return {
    month: month.key,
    rows,
    summary: {
      totalHours: totalHours.toFixed(2),
      approvedHours: approvedHours.toFixed(2),
      pendingHours: pendingHours.toFixed(2),
      approvedAmountCzk: money(approvedHours, rate),
      pendingAmountCzk: money(pendingHours, rate),
    },
  };
}
