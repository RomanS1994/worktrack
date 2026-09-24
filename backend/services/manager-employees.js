import { calculateNetWorkSummary } from './work-time-calculation.js';
import { getWeekRange, serializeWeek } from './week-utils.js';
import { avatarUrl } from './avatars.js';

const EMPLOYEE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  name: true,
  phone: true,
  profile: true,
  deletedAt: true,
};
const EMPLOYEE_WEEK_ENTRY_SELECT = {
  id: true,
  employeeMembershipId: true,
  projectId: true,
  workDate: true,
  hours: true,
  grossHours: true,
  breakMinutes: true,
  hourlyRateCzk: true,
  status: true,
};

function employeeName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.name || user?.email || '';
}

function serializeUser(user) {
  const profile = user?.profile && typeof user.profile === 'object' && !Array.isArray(user.profile)
    ? user.profile
    : {};
  return {
    id: user?.id || '',
    email: user?.email || '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    name: user?.name || '',
    phone: user?.phone || '',
    avatarDataUrl: avatarUrl(user?.id, profile),
  };
}

export async function getManagerEmployees(client, context, now = new Date()) {
  const manager = context?.activeMembership;
  if (!manager || manager.role !== 'MANAGER' || manager.status === 'INACTIVE' || manager.deletedAt) {
    throw new Error('Manager access is required');
  }

  const range = getWeekRange(now);
  const [employees, companyRules] = await Promise.all([
    client.companyMembership.findMany({
      where: {
        companyId: manager.companyId,
        deletedAt: null,
        user: { is: { deletedAt: null } },
      },
      include: {
        user: { select: EMPLOYEE_USER_SELECT },
        workEntries: {
          where: {
            workDate: { gte: range.weekStart, lt: range.nextWeekStart },
          },
          select: EMPLOYEE_WEEK_ENTRY_SELECT,
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
  ]);

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
    employees: employees.map(employee => ({
      id: employee.id,
      userId: employee.userId,
      companyId: employee.companyId,
      role: employee.role,
      canAccessEmployeeCabinet: true,
      canAccessManagerCabinet: employee.role === 'MANAGER',
      status: employee.status,
      hourlyRateCzk: employee.hourlyRateCzk == null ? '0.00' : String(employee.hourlyRateCzk),
      customerRateCzk: employee.customerRateCzk == null
        ? (employee.hourlyRateCzk == null ? '0.00' : String(employee.hourlyRateCzk))
        : String(employee.customerRateCzk),
      pendingSubmissions: Array.isArray(employee.weeklySubmissions) ? employee.weeklySubmissions.length : 0,
      user: serializeUser(employee.user),
      email: employee.user?.email || '',
      firstName: employee.user?.firstName || '',
      lastName: employee.user?.lastName || '',
      name: employeeName(employee.user),
      avatarDataUrl: serializeUser(employee.user).avatarDataUrl,
      summary: calculateNetWorkSummary(employee.workEntries || [], employee.hourlyRateCzk || 0, rules),
    })),
  };
}
