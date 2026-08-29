import { calculateNetWorkSummary } from './work-time-calculation.js';
import { getWeekRange, serializeWeek } from './worktrack.js';

function employeeName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.name || user?.email || '';
}

function serializeUser(user) {
  return {
    id: user?.id || '',
    email: user?.email || '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    name: user?.name || '',
    phone: user?.phone || '',
  };
}

export async function getManagerEmployees(client, context, now = new Date()) {
  const manager = context?.activeMembership;
  if (!manager || manager.role !== 'MANAGER' || manager.status === 'INACTIVE') {
    throw new Error('Manager access is required');
  }

  const range = getWeekRange(now);
  const [employees, companyRules, deletionLogs] = await Promise.all([
    client.companyMembership.findMany({
      where: {
        companyId: manager.companyId,
        role: 'EMPLOYEE',
        user: { is: { deletedAt: null } },
      },
      include: {
        user: true,
        workEntries: {
          where: {
            workDate: { gte: range.weekStart, lt: range.nextWeekStart },
          },
          orderBy: { workDate: 'asc' },
        },
        weeklySubmissions: {
          where: { status: 'SUBMITTED' },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    client.company.findUnique({
      where: { id: manager.companyId },
      select: { breakMinutes: true, standardDailyHours: true },
    }),
    client.auditLog.findMany({
      where: {
        action: 'employee.deleted',
        entityType: 'company_membership',
        entityId: { not: null },
      },
      select: { entityId: true },
    }),
  ]);

  const deletedMembershipIds = new Set(deletionLogs.map(log => log.entityId).filter(Boolean));
  const visibleEmployees = employees.filter(employee => !deletedMembershipIds.has(employee.id));
  const rules = {
    breakMinutes: Number(companyRules?.breakMinutes || 0),
    standardDailyHours: Number(companyRules?.standardDailyHours || 8),
  };

  return {
    week: serializeWeek(range),
    workRules: {
      breakMinutes: rules.breakMinutes,
      standardDailyHours: rules.standardDailyHours.toFixed(2),
    },
    employees: visibleEmployees.map(employee => ({
      id: employee.id,
      userId: employee.userId,
      companyId: employee.companyId,
      role: employee.role,
      status: employee.status,
      hourlyRateCzk: employee.hourlyRateCzk == null ? '0.00' : String(employee.hourlyRateCzk),
      pendingSubmissions: Array.isArray(employee.weeklySubmissions) ? employee.weeklySubmissions.length : 0,
      user: serializeUser(employee.user),
      email: employee.user?.email || '',
      firstName: employee.user?.firstName || '',
      lastName: employee.user?.lastName || '',
      name: employeeName(employee.user),
      summary: calculateNetWorkSummary(employee.workEntries || [], employee.hourlyRateCzk || 0, rules),
    })),
  };
}
