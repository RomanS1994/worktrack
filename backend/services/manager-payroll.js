import { calculateWorkSummary } from './worktrack.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_TYPES = new Set(['week', 'month']);

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function parseAnchor(value) {
  const raw = String(value || '').trim();
  const fallback = new Date();

  if (!raw) {
    return new Date(Date.UTC(fallback.getFullYear(), fallback.getMonth(), fallback.getDate()));
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error('Invalid payroll anchor date');
  }

  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || toDateKey(parsed) !== raw) {
    throw new Error('Invalid payroll anchor date');
  }

  return parsed;
}

function resolvePeriod(typeInput, anchorInput) {
  const type = String(typeInput || 'week').trim().toLowerCase();
  if (!PERIOD_TYPES.has(type)) {
    throw new Error('Invalid payroll period');
  }

  const anchor = parseAnchor(anchorInput);
  let start;
  let next;

  if (type === 'month') {
    start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    next = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  } else {
    const day = anchor.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start = new Date(anchor.getTime() + mondayOffset * DAY_MS);
    next = new Date(start.getTime() + 7 * DAY_MS);
  }

  const end = new Date(next.getTime() - DAY_MS);

  return {
    type,
    anchor: toDateKey(anchor),
    start,
    end,
    next,
    startKey: toDateKey(start),
    endKey: toDateKey(end),
  };
}

function toHundredths(value) {
  const normalized = Number(String(value ?? '0').replace(',', '.'));
  return Number.isFinite(normalized) ? Math.round(normalized * 100) : 0;
}

function formatHundredths(value) {
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(Math.trunc(value));
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

function getEmployeeName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.name || user?.email || 'Employee';
}

function calculateOvertime(entries = [], standardDailyHours = 8) {
  const dailyNorm = Math.max(0, toHundredths(standardDailyHours));
  const totalsByDay = new Map();
  const approvedByDay = new Map();
  const pendingByDay = new Map();

  for (const entry of entries) {
    const day = toDateKey(entry.workDate instanceof Date ? entry.workDate : new Date(entry.workDate));
    const hours = toHundredths(entry.hours);
    totalsByDay.set(day, (totalsByDay.get(day) || 0) + hours);

    if (entry.status === 'APPROVED') {
      approvedByDay.set(day, (approvedByDay.get(day) || 0) + hours);
    } else if (entry.status === 'DRAFT' || entry.status === 'SUBMITTED') {
      pendingByDay.set(day, (pendingByDay.get(day) || 0) + hours);
    }
  }

  let overtime = 0;
  let approvedOvertime = 0;
  let pendingOvertime = 0;

  for (const [day, total] of totalsByDay) {
    const dayOvertime = Math.max(0, total - dailyNorm);
    overtime += dayOvertime;
    if (!dayOvertime) continue;

    const approved = approvedByDay.get(day) || 0;
    const pending = pendingByDay.get(day) || 0;
    const approvedBase = Math.min(approved, dailyNorm);
    approvedOvertime += Math.max(0, approved - approvedBase);
    pendingOvertime += Math.max(0, dayOvertime - Math.max(0, approved - dailyNorm));

    if (!approved && pending) {
      pendingOvertime -= Math.max(0, dayOvertime - pending);
    }
  }

  return {
    overtimeHours: formatHundredths(overtime),
    approvedOvertimeHours: formatHundredths(approvedOvertime),
    pendingOvertimeHours: formatHundredths(Math.max(0, pendingOvertime)),
  };
}

export async function getManagerPayroll(client, context, query = {}) {
  const managerMembership = context?.activeMembership;
  if (!managerMembership || managerMembership.role !== 'MANAGER') {
    throw new Error('Manager access is required');
  }

  const period = resolvePeriod(query.period, query.anchor);
  const [company, memberships] = await Promise.all([
    client.company.findUnique({
      where: { id: managerMembership.companyId },
      select: { standardDailyHours: true },
    }),
    client.companyMembership.findMany({
      where: {
        companyId: managerMembership.companyId,
        role: 'EMPLOYEE',
        user: {
          is: {
            deletedAt: null,
          },
        },
      },
      include: {
        user: true,
        workEntries: {
          where: {
            workDate: {
              gte: period.start,
              lt: period.next,
            },
            status: {
              in: ['DRAFT', 'SUBMITTED', 'APPROVED'],
            },
          },
          orderBy: {
            workDate: 'asc',
          },
        },
      },
      orderBy: [
        {
          createdAt: 'asc',
        },
      ],
    }),
  ]);

  const standardDailyHours = Number(company?.standardDailyHours || 8);
  let approvedHours = 0;
  let pendingHours = 0;
  let overtimeHours = 0;
  let approvedOvertimeHours = 0;
  let pendingOvertimeHours = 0;
  let confirmedSalary = 0;
  let predictedSalary = 0;
  let employeesWithHours = 0;

  const employees = memberships.map(membership => {
    const summary = calculateWorkSummary(
      membership.workEntries || [],
      membership.hourlyRateCzk ?? '0'
    );
    const overtime = calculateOvertime(membership.workEntries || [], standardDailyHours);
    const summaryWithOvertime = { ...summary, ...overtime };

    if (toHundredths(summary.totalHours) > 0) {
      employeesWithHours += 1;
    }

    approvedHours += toHundredths(summary.approvedHours);
    pendingHours += toHundredths(summary.pendingHours);
    overtimeHours += toHundredths(overtime.overtimeHours);
    approvedOvertimeHours += toHundredths(overtime.approvedOvertimeHours);
    pendingOvertimeHours += toHundredths(overtime.pendingOvertimeHours);
    confirmedSalary += toHundredths(summary.confirmedSalaryCzk);
    predictedSalary += toHundredths(summary.predictedSalaryCzk);

    return {
      id: membership.id,
      userId: membership.userId,
      name: getEmployeeName(membership.user),
      email: membership.user?.email || '',
      status: membership.status,
      hourlyRateCzk: membership.hourlyRateCzk == null ? '0.00' : String(membership.hourlyRateCzk),
      summary: summaryWithOvertime,
    };
  });

  return {
    role: 'MANAGER',
    company: {
      id: managerMembership.companyId,
      name: context?.activeCompany?.name || managerMembership.company?.name || '',
      standardDailyHours: standardDailyHours.toFixed(2),
    },
    period: {
      type: period.type,
      anchor: period.anchor,
      start: period.startKey,
      end: period.endKey,
    },
    employees,
    summary: {
      employeeCount: employees.length,
      employeesWithHours,
      approvedHours: formatHundredths(approvedHours),
      pendingHours: formatHundredths(pendingHours),
      overtimeHours: formatHundredths(overtimeHours),
      approvedOvertimeHours: formatHundredths(approvedOvertimeHours),
      pendingOvertimeHours: formatHundredths(pendingOvertimeHours),
      confirmedSalaryCzk: formatHundredths(confirmedSalary),
      predictedSalaryCzk: formatHundredths(predictedSalary),
    },
  };
}
