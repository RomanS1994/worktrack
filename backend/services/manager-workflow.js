import { randomUUID } from 'node:crypto';

import { hashPassword } from '../auth/tokens.js';
import { createAuditLog } from '../db/prisma-helpers.js';
import { normalizeEmail, normalizeText, nowIso } from '../validation/common.js';

const REVIEWABLE_STATUS = 'SUBMITTED';
const WEEKLY_SUBMISSION_STATUS_VALUES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];
const MEMBERSHIP_STATUS_VALUES = ['ACTIVE', 'INACTIVE'];

function toIsoDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function toIsoTimestamp(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function normalizeHoursString(value) {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error('Invalid hours value');
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 24) throw new Error('Invalid hours value');
  return amount.toFixed(2);
}

function normalizeClockTime(value) {
  const raw = normalizeText(value);
  const match = /^(\d{2}):(\d{2})$/.exec(raw);
  if (!match) throw new Error('Invalid work time');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error('Invalid work time');
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeMoneyString(value) {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error('Invalid hourly rate');
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Invalid hourly rate');
  return amount.toFixed(2);
}

function decimalToHundredths(value) {
  const raw = String(value ?? '0').trim();
  const sign = raw.startsWith('-') ? -1 : 1;
  const normalized = raw.replace(/^-/, '');
  const [whole = '0', fraction = ''] = normalized.split('.');
  return sign * (Number(whole || 0) * 100 + Number(`${fraction}00`.slice(0, 2) || 0));
}

function formatHundredths(value) {
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(Math.round(value));
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

function calculateWorkSummary(entries = [], hourlyRateCzk = '0') {
  const rateCents = decimalToHundredths(hourlyRateCzk);
  let total = 0;
  let approved = 0;
  let pending = 0;
  for (const entry of entries) {
    const hours = decimalToHundredths(entry.hours);
    total += hours;
    if (entry.status === 'APPROVED') approved += hours;
    else if (entry.status === 'DRAFT' || entry.status === 'SUBMITTED') pending += hours;
  }
  const salary = hours => Math.round((hours * rateCents) / 100);
  return {
    totalHours: formatHundredths(total),
    approvedHours: formatHundredths(approved),
    pendingHours: formatHundredths(pending),
    confirmedSalaryCzk: formatHundredths(salary(approved)),
    predictedSalaryCzk: formatHundredths(salary(pending)),
  };
}

function ensureManagerContext(context) {
  const membership = context?.activeMembership || context?.membership || context || null;
  if (!membership?.companyId || membership.status === 'INACTIVE') throw new Error('Company access is required');
  if (membership.role !== 'MANAGER') throw new Error('Manager access is required');
  return membership;
}

function serializeProject(project) {
  if (!project) return null;
  return {
    id: project.id,
    companyId: project.companyId,
    name: normalizeText(project.name),
    address: normalizeText(project.address),
    description: normalizeText(project.description),
    isActive: Boolean(project.isActive),
    createdAt: toIsoTimestamp(project.createdAt),
    updatedAt: toIsoTimestamp(project.updatedAt),
  };
}

function serializeUserSummary(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: normalizeText(user.firstName),
    lastName: normalizeText(user.lastName),
    name: normalizeText(user.name),
    phone: user.phone || '',
  };
}

function serializeEmployeeMembership(membership) {
  if (!membership) return null;
  const user = membership.user || null;
  const entries = Array.isArray(membership.workEntries) ? membership.workEntries : [];
  return {
    id: membership.id,
    userId: membership.userId,
    companyId: membership.companyId,
    role: membership.role,
    canAccessEmployeeCabinet: true,
    canAccessManagerCabinet: membership.role === 'MANAGER',
    status: membership.status,
    hourlyRateCzk: membership.hourlyRateCzk == null ? '0.00' : String(membership.hourlyRateCzk),
    pendingSubmissions: Array.isArray(membership.weeklySubmissions) ? membership.weeklySubmissions.length : 0,
    user: serializeUserSummary(user),
    email: user?.email || '',
    firstName: normalizeText(user?.firstName),
    lastName: normalizeText(user?.lastName),
    name: normalizeText(user?.name) || user?.email || '',
    summary: calculateWorkSummary(entries, membership.hourlyRateCzk ?? '0'),
  };
}

function serializeWorkEntry(entry) {
  const membership = entry.employeeMembership || null;
  return {
    id: entry.id,
    companyId: entry.companyId,
    employeeMembershipId: entry.employeeMembershipId,
    employeeId: membership?.userId || entry.employeeId || '',
    projectId: entry.projectId,
    project: serializeProject(entry.project),
    weeklySubmissionId: entry.weeklySubmissionId || '',
    workDate: toIsoDate(entry.workDate),
    hours: formatHundredths(decimalToHundredths(entry.hours)),
    status: entry.status,
    createdAt: toIsoTimestamp(entry.createdAt),
    updatedAt: toIsoTimestamp(entry.updatedAt),
  };
}

function serializeWeeklySubmission(submission) {
  if (!submission) return null;
  const entries = Array.isArray(submission.workEntries) ? submission.workEntries : [];
  const employeeMembership = submission.employeeMembership || null;
  return {
    id: submission.id,
    companyId: submission.companyId,
    employeeMembershipId: submission.employeeMembershipId,
    reviewedByMembershipId: submission.reviewedByMembershipId || '',
    employeeId: employeeMembership?.userId || submission.employeeId || '',
    weekStart: toIsoDate(submission.weekStart),
    weekEnd: toIsoDate(submission.weekEnd),
    status: submission.status,
    submittedAt: toIsoTimestamp(submission.submittedAt),
    reviewedAt: toIsoTimestamp(submission.reviewedAt),
    rejectionReason: normalizeText(submission.rejectionReason),
    createdAt: toIsoTimestamp(submission.createdAt),
    updatedAt: toIsoTimestamp(submission.updatedAt),
    employee: serializeEmployeeMembership(employeeMembership),
    entries: entries.map(serializeWorkEntry),
    summary: calculateWorkSummary(entries, employeeMembership?.hourlyRateCzk ?? '0'),
  };
}

async function findProjectInCompany(client, companyId, projectId) {
  const id = normalizeText(projectId);
  if (!id) throw new Error('Project is required');
  const project = await client.project.findFirst({ where: { id, companyId, isActive: true } });
  if (!project) throw new Error('Project not found');
  return project;
}

async function getSubmissionByCompany(client, companyId, submissionId, notFoundMessage = 'Weekly submission not found') {
  const submission = await client.weeklySubmission.findFirst({
    where: { id: submissionId, companyId },
    include: {
      employeeMembership: { include: { user: true } },
      workEntries: { include: { project: true }, orderBy: { workDate: 'asc' } },
    },
  });
  if (!submission) throw new Error(notFoundMessage);
  return serializeWeeklySubmission(submission);
}

function normalizeSubmissionStatusFilter(value) {
  const status = normalizeText(value).toUpperCase();
  if (!status || status === 'ALL') return '';
  if (!WEEKLY_SUBMISSION_STATUS_VALUES.includes(status)) throw new Error('Invalid weekly submission status');
  return status;
}

async function ensureManagerWillRemain(client, companyId, membershipId) {
  const remainingManagers = await client.companyMembership.count({
    where: {
      companyId,
      id: { not: membershipId },
      role: 'MANAGER',
      status: 'ACTIVE',
      deletedAt: null,
      user: { is: { deletedAt: null } },
    },
  });
  if (remainingManagers < 1) throw new Error('Company must have at least one active manager');
}

export async function createManagerEmployee(client, context, payload = {}) {
  const managerMembership = ensureManagerContext(context);
  const firstName = normalizeText(payload.firstName);
  const lastName = normalizeText(payload.lastName);
  const email = normalizeEmail(payload.email);
  const temporaryPassword = String(payload.temporaryPassword || payload.password || '');
  const hourlyRateCzk = normalizeMoneyString(payload.hourlyRateCzk);
  if (!firstName) throw new Error('First name is required');
  if (!lastName) throw new Error('Last name is required');
  if (!email) throw new Error('Email is required');

  const existingUser = await client.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await client.companyMembership.findUnique({
      where: { companyId_userId: { companyId: managerMembership.companyId, userId: existingUser.id } },
    });
    if (existingMembership) throw new Error('Employee already belongs to this company');
  } else if (temporaryPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  const timestamp = new Date(nowIso());
  const user = existingUser || await client.user.create({
    data: {
      id: randomUUID(),
      name: [firstName, lastName].filter(Boolean).join(' '),
      email,
      firstName,
      lastName,
      passwordHash: hashPassword(temporaryPassword),
      mustChangePassword: true,
      profile: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  });

  const membership = await client.companyMembership.create({
    data: {
      id: randomUUID(),
      companyId: managerMembership.companyId,
      userId: user.id,
      role: payload.canAccessManagerCabinet === true ? 'MANAGER' : 'EMPLOYEE',
      hourlyRateCzk,
      status: 'ACTIVE',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    include: { user: true, workEntries: true, weeklySubmissions: true },
  });

  await createAuditLog(client, {
    action: 'employee.created',
    actorUserId: managerMembership.userId,
    targetUserId: user.id,
    entityType: 'company_membership',
    entityId: membership.id,
    after: { companyId: managerMembership.companyId, role: membership.role, hourlyRateCzk: membership.hourlyRateCzk },
  });
  return serializeEmployeeMembership(membership);
}

export async function updateEmployeeMembership(client, context, employeeMembershipId, payload = {}) {
  const managerMembership = ensureManagerContext(context);
  const existing = await client.companyMembership.findFirst({
    where: { id: employeeMembershipId, companyId: managerMembership.companyId, deletedAt: null },
    include: { user: true },
  });
  if (!existing) throw new Error('Employee not found');

  const data = { updatedAt: new Date(nowIso()) };
  if (Object.prototype.hasOwnProperty.call(payload, 'hourlyRateCzk')) data.hourlyRateCzk = normalizeMoneyString(payload.hourlyRateCzk);
  if (Object.prototype.hasOwnProperty.call(payload, 'canAccessManagerCabinet')) {
    const managerAccess = payload.canAccessManagerCabinet === true;
    if (existing.role === 'MANAGER' && !managerAccess) {
      await ensureManagerWillRemain(client, managerMembership.companyId, existing.id);
    }
    data.role = managerAccess ? 'MANAGER' : 'EMPLOYEE';
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    const status = normalizeText(payload.status).toUpperCase();
    if (!MEMBERSHIP_STATUS_VALUES.includes(status)) throw new Error('Invalid membership status');
    if (existing.role === 'MANAGER' && existing.status === 'ACTIVE' && status === 'INACTIVE') {
      await ensureManagerWillRemain(client, managerMembership.companyId, existing.id);
    }
    data.status = status;
  }

  const membership = await client.companyMembership.update({
    where: { id: existing.id },
    data,
    include: { user: true, workEntries: true, weeklySubmissions: true },
  });
  await createAuditLog(client, {
    action: 'employee.updated',
    actorUserId: managerMembership.userId,
    targetUserId: membership.userId,
    entityType: 'company_membership',
    entityId: membership.id,
    before: serializeEmployeeMembership(existing),
    after: serializeEmployeeMembership(membership),
  });
  return serializeEmployeeMembership(membership);
}

export async function listManagerSubmissions(client, context, query = {}) {
  const membership = ensureManagerContext(context);
  const status = normalizeSubmissionStatusFilter(query.status || 'SUBMITTED');
  const submissions = await client.weeklySubmission.findMany({
    where: {
      companyId: membership.companyId,
      employeeMembershipId: { not: membership.id },
      ...(status ? { status } : {}),
      employeeMembership: { is: { deletedAt: null, user: { is: { deletedAt: null } } } },
    },
    include: {
      employeeMembership: { include: { user: true } },
      workEntries: { include: { project: true }, orderBy: { workDate: 'asc' } },
    },
    orderBy: [{ submittedAt: 'desc' }, { weekStart: 'desc' }],
  });
  return { submissions: submissions.map(serializeWeeklySubmission) };
}

export async function getManagerSubmissionById(client, context, submissionId, { notFoundMessage = 'Weekly submission not found' } = {}) {
  const membership = ensureManagerContext(context);
  return getSubmissionByCompany(client, membership.companyId, submissionId, notFoundMessage);
}

export async function updateSubmittedWorkEntryByManager(client, context, entryId, payload = {}) {
  const managerMembership = ensureManagerContext(context);
  const existing = await client.workEntry.findUnique({
    where: { id: entryId },
    include: { weeklySubmission: true, project: true, employeeMembership: { select: { userId: true } } },
  });
  if (!existing || existing.companyId !== managerMembership.companyId) throw new Error('Work entry not found');
  if (existing.employeeMembershipId === managerMembership.id) throw new Error('Managers cannot review their own submission');
  if (existing.status !== REVIEWABLE_STATUS || existing.weeklySubmission?.status !== REVIEWABLE_STATUS) {
    throw new Error('Work entry is not pending review');
  }

  const projectId = Object.prototype.hasOwnProperty.call(payload, 'projectId')
    ? (await findProjectInCompany(client, managerMembership.companyId, payload.projectId)).id
    : existing.projectId;
  const duplicate = await client.workEntry.findFirst({
    where: {
      companyId: managerMembership.companyId,
      employeeMembershipId: existing.employeeMembershipId,
      projectId,
      workDate: existing.workDate,
      id: { not: existing.id },
    },
    select: { id: true },
  });
  if (duplicate) throw new Error('Work entry already exists');

  const hasStartTime = Object.prototype.hasOwnProperty.call(payload, 'startTime');
  const hasEndTime = Object.prototype.hasOwnProperty.call(payload, 'endTime');
  const hasHours = Object.prototype.hasOwnProperty.call(payload, 'hours');
  const data = { projectId, updatedAt: new Date(nowIso()) };
  if (hasStartTime !== hasEndTime) throw new Error('Start and end time are required');

  if (hasStartTime && hasEndTime) {
    const startTime = normalizeClockTime(payload.startTime);
    const endTime = normalizeClockTime(payload.endTime);
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    let endMinutes = endHour * 60 + endMinute;
    if (endMinutes <= startMinutes) endMinutes += 24 * 60;
    const grossMinutes = endMinutes - startMinutes;
    if (grossMinutes <= 0 || grossMinutes > 24 * 60) throw new Error('Invalid work time range');
    const company = await client.company.findUnique({
      where: { id: managerMembership.companyId },
      select: { breakMinutes: true },
    });
    const configuredBreakMinutes = Math.max(0, Number(company?.breakMinutes || 0));
    const breakMinutes = grossMinutes > configuredBreakMinutes ? configuredBreakMinutes : 0;
    const netMinutes = grossMinutes - breakMinutes;
    if (netMinutes <= 0) throw new Error('Work time must be longer than the automatic break');
    data.startTime = startTime;
    data.endTime = endTime;
    data.grossHours = (grossMinutes / 60).toFixed(2);
    data.breakMinutes = breakMinutes;
    data.hours = (netMinutes / 60).toFixed(2);
  } else if (hasHours) {
    data.hours = normalizeHoursString(payload.hours);
    data.grossHours = null;
    data.breakMinutes = 0;
    data.startTime = null;
    data.endTime = null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'note')) data.note = normalizeText(payload.note).slice(0, 1200) || null;

  const entry = await client.workEntry.update({
    where: { id: existing.id },
    data,
    include: { project: true, employeeMembership: { select: { userId: true } } },
  });
  await createAuditLog(client, {
    action: 'work_entry.manager_updated',
    actorUserId: managerMembership.userId,
    targetUserId: entry.employeeMembership?.userId || null,
    entityType: 'work_entry',
    entityId: entry.id,
    before: serializeWorkEntry(existing),
    after: serializeWorkEntry(entry),
  });
  return {
    ...serializeWorkEntry(entry),
    startTime: entry.startTime || null,
    endTime: entry.endTime || null,
    grossHours: entry.grossHours == null ? null : String(entry.grossHours),
    breakMinutes: Number(entry.breakMinutes || 0),
    note: entry.note || '',
  };
}

export async function reviewWeeklySubmission(client, context, submissionId, decision, payload = {}) {
  const managerMembership = ensureManagerContext(context);
  const nextStatus = decision === 'approve' ? 'APPROVED' : 'REJECTED';
  const rejectionReason = nextStatus === 'REJECTED' ? normalizeText(payload.rejectionReason).slice(0, 500) : '';
  const submission = await client.weeklySubmission.findFirst({
    where: {
      id: submissionId,
      companyId: managerMembership.companyId,
      employeeMembership: { is: { deletedAt: null, user: { is: { deletedAt: null } } } },
    },
    include: {
      employeeMembership: { include: { user: true } },
      workEntries: { include: { project: true } },
    },
  });
  if (!submission) throw new Error('Weekly submission not found');
  if (submission.employeeMembershipId === managerMembership.id) throw new Error('Managers cannot review their own submission');
  if (submission.status !== REVIEWABLE_STATUS) throw new Error('Weekly submission is not pending review');

  const timestamp = new Date(nowIso());
  await client.workEntry.updateMany({
    where: { companyId: managerMembership.companyId, weeklySubmissionId: submission.id },
    data: { status: nextStatus, updatedAt: timestamp },
  });
  await client.weeklySubmission.update({
    where: { id: submission.id },
    data: {
      status: nextStatus,
      reviewedByMembershipId: managerMembership.id,
      reviewedAt: timestamp,
      rejectionReason: nextStatus === 'REJECTED' ? rejectionReason || null : null,
      updatedAt: timestamp,
    },
  });
  await createAuditLog(client, {
    action: nextStatus === 'APPROVED' ? 'weekly_submission.approved' : 'weekly_submission.rejected',
    actorUserId: managerMembership.userId,
    targetUserId: submission.employeeMembership?.userId || null,
    entityType: 'weekly_submission',
    entityId: submission.id,
    before: { status: submission.status },
    after: {
      status: nextStatus,
      reviewedByMembershipId: managerMembership.id,
      rejectionReason: nextStatus === 'REJECTED' ? rejectionReason : '',
    },
  });
  return getSubmissionByCompany(client, managerMembership.companyId, submission.id);
}
