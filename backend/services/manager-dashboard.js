import { getManagerPayroll } from './manager-payroll.js';
import { getWeekRange, serializeWeek } from './week-utils.js';

function employeeName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.name || user?.email || 'Employee';
}

function serializeSubmissionStatus(submission) {
  if (!submission) return 'NOT_SUBMITTED';
  return submission.status || 'NOT_SUBMITTED';
}

export async function getManagerDashboard(client, context, now = new Date()) {
  const membership = context?.activeMembership;
  if (!membership || membership.role !== 'MANAGER' || membership.status === 'INACTIVE') {
    throw new Error('Manager access is required');
  }

  const range = getWeekRange(now);
  const week = serializeWeek(range);
  const [payroll, activeProjectCount, pendingSubmissions, employees] = await Promise.all([
    getManagerPayroll(client, context, { period: 'week', anchor: week.weekStart }),
    client.project.count({
      where: {
        companyId: membership.companyId,
        isActive: true,
      },
    }),
    client.weeklySubmission.count({
      where: {
        companyId: membership.companyId,
        employeeMembershipId: { not: membership.id },
        weekStart: range.weekStart,
        status: 'SUBMITTED',
      },
    }),
    client.companyMembership.findMany({
      where: {
        companyId: membership.companyId,
        status: 'ACTIVE',
        deletedAt: null,
        user: { is: { deletedAt: null } },
      },
      include: {
        user: true,
        weeklySubmissions: {
          where: { weekStart: range.weekStart },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const employeeStatuses = employees.map(employee => {
    const submission = employee.weeklySubmissions?.[0] || null;
    return {
      id: employee.id,
      name: employeeName(employee.user),
      email: employee.user?.email || '',
      status: serializeSubmissionStatus(submission),
      submittedAt: submission?.submittedAt?.toISOString?.() || '',
      rejectionReason: submission?.rejectionReason || '',
    };
  });

  const notSubmitted = employeeStatuses.filter(item => item.status === 'NOT_SUBMITTED');
  const needsChanges = employeeStatuses.filter(item => item.status === 'REJECTED');
  const submitted = employeeStatuses.filter(item => item.status === 'SUBMITTED');
  const approved = employeeStatuses.filter(item => item.status === 'APPROVED');

  return {
    role: 'MANAGER',
    company: payroll.company,
    week,
    summary: {
      employeeCount: employees.length,
      activeProjectCount,
      pendingSubmissions,
      approvedHours: payroll.summary.approvedHours,
      pendingHours: payroll.summary.pendingHours,
      confirmedSalaryCzk: payroll.summary.confirmedSalaryCzk,
      predictedSalaryCzk: payroll.summary.predictedSalaryCzk,
      notSubmittedCount: notSubmitted.length,
      needsChangesCount: needsChanges.length,
    },
    team: {
      notSubmitted,
      needsChanges,
      submitted,
      approved,
    },
  };
}
