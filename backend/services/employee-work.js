import { randomUUID } from 'node:crypto';

import { createAuditLog } from '../db/prisma-helpers.js';
import { normalizeText, nowIso } from '../validation/common.js';
import { getWeekRange, serializeWeek } from './week-utils.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const EDITABLE_ENTRY_STATUSES = new Set(['DRAFT', 'REJECTED']);
const LOCKED_SUBMISSION_STATUSES = ['SUBMITTED', 'APPROVED'];

function parseDate(value, message = 'Invalid work date') {
  const raw = normalizeText(value);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00.000Z`)
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(message);
  return parsed;
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function toIsoDate(date) {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function toIsoTimestamp(value) {
  if (!value) return '';
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function monthKey(date) {
  return toIsoDate(date).slice(0, 7);
}

function monthSegment(range, key) {
  const [year, month] = key.split('-').map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const monthEnd = addDays(nextMonth, -1);
  return {
    start: range.weekStart > monthStart ? range.weekStart : monthStart,
    end: range.weekEnd < monthEnd ? range.weekEnd : monthEnd,
  };
}

export function getEmployeeWeekRange(value = new Date()) {
  return getWeekRange(value);
}

function normalizeHoursString(value) {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error('Invalid hours value');
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 24) throw new Error('Invalid hours value');
  return amount.toFixed(2);
}

function decimalToHundredths(value) {
  const raw = String(value ?? '0').trim();
  const sign = raw.startsWith('-') ? -1 : 1;
  const normalized = raw.replace(/^-/, '');
  const [whole = '0', fraction = ''] = normalized.split('.');
  const cents = `${fraction}00`.slice(0, 2);
  return sign * (Number(whole || 0) * 100 + Number(cents || 0));
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

function ensureEmployeeContext(context) {
  const membership = context?.activeMembership || context?.membership || context || null;
  if (!membership?.companyId || membership.status === 'INACTIVE') throw new Error('Company access is required');
  if (!['EMPLOYEE', 'MANAGER'].includes(membership.role)) throw new Error('Employee access is required');
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

export function serializeEmployeeWorkEntry(entry) {
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
    entries: entries.map(serializeEmployeeWorkEntry),
    summary: calculateWorkSummary(entries, employeeMembership?.hourlyRateCzk ?? '0'),
  };
}

function ensureEntryEditable(entry) {
  if (!entry || !EDITABLE_ENTRY_STATUSES.has(entry.status)) throw new Error('Work entry is locked');
  if (entry.weeklySubmission && LOCKED_SUBMISSION_STATUSES.includes(entry.weeklySubmission.status)) {
    throw new Error('Work entry is locked');
  }
}

async function findSubmissionsForWeek(client, employeeMembershipId, range) {
  return client.weeklySubmission.findMany({
    where: {
      employeeMembershipId,
      weekStart: { lt: range.nextWeekStart },
      weekEnd: { gte: range.weekStart },
    },
    orderBy: [{ weekStart: 'asc' }, { createdAt: 'asc' }],
  });
}

async function ensureDateOpenForEditing(client, employeeMembershipId, workDate) {
  const locked = await client.weeklySubmission.findFirst({
    where: {
      employeeMembershipId,
      status: { in: LOCKED_SUBMISSION_STATUSES },
      weekStart: { lte: workDate },
      weekEnd: { gte: workDate },
    },
    select: { id: true },
  });
  if (locked) throw new Error('Work entry is locked');
}

async function findProjectInCompany(client, companyId, projectId) {
  const id = normalizeText(projectId);
  if (!id) throw new Error('Project is required');
  const project = await client.project.findFirst({ where: { id, companyId, isActive: true } });
  if (!project) throw new Error('Project not found');
  return project;
}

async function getSubmissionByCompany(client, companyId, submissionId) {
  const submission = await client.weeklySubmission.findFirst({
    where: { id: submissionId, companyId },
    include: {
      employeeMembership: { include: { user: true } },
      workEntries: { include: { project: true }, orderBy: { workDate: 'asc' } },
    },
  });
  if (!submission) throw new Error('Weekly submission not found');
  return serializeWeeklySubmission(submission);
}

export async function getEmployeeWeek(client, context, weekStartInput) {
  const membership = ensureEmployeeContext(context);
  const range = getEmployeeWeekRange(weekStartInput || new Date());
  const [entries, submissions] = await Promise.all([
    client.workEntry.findMany({
      where: {
        companyId: membership.companyId,
        employeeMembershipId: membership.id,
        workDate: { gte: range.weekStart, lt: range.nextWeekStart },
      },
      include: { project: true },
      orderBy: [{ workDate: 'asc' }, { createdAt: 'asc' }],
    }),
    findSubmissionsForWeek(client, membership.id, range),
  ]);

  const editableEntries = entries.filter(entry => EDITABLE_ENTRY_STATUSES.has(entry.status));
  const serializedSubmissions = submissions.map(serializeWeeklySubmission);
  const representativeSubmission = editableEntries.length
    ? null
    : serializedSubmissions.find(item => item.status === 'SUBMITTED')
      || serializedSubmissions.find(item => item.status === 'APPROVED')
      || serializedSubmissions[serializedSubmissions.length - 1]
      || null;

  return {
    week: serializeWeek(range),
    entries: entries.map(serializeEmployeeWorkEntry),
    submission: representativeSubmission,
    submissions: serializedSubmissions,
    hasEditableEntries: editableEntries.length > 0,
    summary: calculateWorkSummary(entries, membership.hourlyRateCzk ?? '0'),
  };
}

export async function createEmployeeWorkEntry(client, context, payload = {}) {
  const membership = ensureEmployeeContext(context);
  const workDate = startOfUtcDay(parseDate(payload.workDate));
  await ensureDateOpenForEditing(client, membership.id, workDate);
  const project = await findProjectInCompany(client, membership.companyId, payload.projectId);
  const existing = await client.workEntry.findFirst({
    where: { companyId: membership.companyId, employeeMembershipId: membership.id, projectId: project.id, workDate },
  });
  if (existing) throw new Error('Work entry already exists');

  const timestamp = new Date(nowIso());
  const entry = await client.workEntry.create({
    data: {
      id: randomUUID(),
      companyId: membership.companyId,
      employeeMembershipId: membership.id,
      projectId: project.id,
      weeklySubmissionId: null,
      workDate,
      hours: normalizeHoursString(payload.hours),
      status: 'DRAFT',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    include: { project: true },
  });
  await createAuditLog(client, {
    action: 'work_entry.created',
    actorUserId: membership.userId,
    targetUserId: membership.userId,
    entityType: 'work_entry',
    entityId: entry.id,
    after: serializeEmployeeWorkEntry(entry),
  });
  return serializeEmployeeWorkEntry(entry);
}

export async function updateEmployeeWorkEntry(client, context, entryId, payload = {}) {
  const membership = ensureEmployeeContext(context);
  const existing = await client.workEntry.findUnique({
    where: { id: entryId },
    include: { weeklySubmission: true, project: true },
  });
  if (!existing || existing.companyId !== membership.companyId || existing.employeeMembershipId !== membership.id) {
    throw new Error('Work entry not found');
  }
  ensureEntryEditable(existing);

  const projectId = Object.prototype.hasOwnProperty.call(payload, 'projectId')
    ? (await findProjectInCompany(client, membership.companyId, payload.projectId)).id
    : existing.projectId;
  const duplicate = await client.workEntry.findFirst({
    where: {
      companyId: membership.companyId,
      employeeMembershipId: membership.id,
      projectId,
      workDate: existing.workDate,
      id: { not: existing.id },
    },
  });
  if (duplicate) throw new Error('Work entry already exists');

  const entry = await client.workEntry.update({
    where: { id: existing.id },
    data: {
      projectId,
      hours: normalizeHoursString(payload.hours),
      status: 'DRAFT',
      weeklySubmissionId: null,
      updatedAt: new Date(nowIso()),
    },
    include: { project: true },
  });
  await createAuditLog(client, {
    action: 'work_entry.updated',
    actorUserId: membership.userId,
    targetUserId: membership.userId,
    entityType: 'work_entry',
    entityId: entry.id,
    before: serializeEmployeeWorkEntry(existing),
    after: serializeEmployeeWorkEntry(entry),
  });
  return serializeEmployeeWorkEntry(entry);
}

export async function deleteEmployeeWorkEntry(client, context, entryId) {
  const membership = ensureEmployeeContext(context);
  const existing = await client.workEntry.findUnique({
    where: { id: entryId },
    include: { weeklySubmission: true, project: true },
  });
  if (!existing || existing.companyId !== membership.companyId || existing.employeeMembershipId !== membership.id) {
    throw new Error('Work entry not found');
  }
  ensureEntryEditable(existing);
  await client.workEntry.delete({ where: { id: existing.id } });
  await createAuditLog(client, {
    action: 'work_entry.deleted',
    actorUserId: membership.userId,
    targetUserId: membership.userId,
    entityType: 'work_entry',
    entityId: existing.id,
    before: serializeEmployeeWorkEntry(existing),
  });
  return { ok: true };
}

export async function submitEmployeeWeek(client, context, payload = {}) {
  const membership = ensureEmployeeContext(context);
  const range = getEmployeeWeekRange(payload.weekStart || new Date());
  const timestamp = new Date(nowIso());

  const draftEntries = await client.workEntry.findMany({
    where: {
      companyId: membership.companyId,
      employeeMembershipId: membership.id,
      workDate: { gte: range.weekStart, lt: range.nextWeekStart },
      status: { in: ['DRAFT', 'REJECTED'] },
    },
    orderBy: { workDate: 'asc' },
  });
  if (!draftEntries.length) throw new Error('No work entries to submit');

  const targetMonth = monthKey(draftEntries[0].workDate);
  const entries = draftEntries.filter(entry => monthKey(entry.workDate) === targetMonth);
  const segment = monthSegment(range, targetMonth);

  let existingSubmission = await client.weeklySubmission.findFirst({
    where: {
      employeeMembershipId: membership.id,
      weekStart: segment.start,
      weekEnd: segment.end,
    },
  });

  if (existingSubmission && LOCKED_SUBMISSION_STATUSES.includes(existingSubmission.status)) {
    throw new Error('Weekly submission is already submitted');
  }

  const submission = existingSubmission
    ? await client.weeklySubmission.update({
        where: { id: existingSubmission.id },
        data: {
          status: 'SUBMITTED',
          submittedAt: timestamp,
          reviewedAt: null,
          reviewedByMembershipId: null,
          rejectionReason: null,
          updatedAt: timestamp,
        },
      })
    : await client.weeklySubmission.create({
        data: {
          id: randomUUID(),
          companyId: membership.companyId,
          employeeMembershipId: membership.id,
          reviewedByMembershipId: null,
          weekStart: segment.start,
          weekEnd: segment.end,
          status: 'SUBMITTED',
          submittedAt: timestamp,
          reviewedAt: null,
          rejectionReason: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      });

  await client.workEntry.updateMany({
    where: {
      id: { in: entries.map(entry => entry.id) },
      companyId: membership.companyId,
      employeeMembershipId: membership.id,
    },
    data: { weeklySubmissionId: submission.id, status: 'SUBMITTED', updatedAt: timestamp },
  });

  await createAuditLog(client, {
    action: 'weekly_submission.submitted',
    actorUserId: membership.userId,
    targetUserId: membership.userId,
    entityType: 'weekly_submission',
    entityId: submission.id,
    after: {
      companyId: membership.companyId,
      weekStart: toIsoDate(segment.start),
      weekEnd: toIsoDate(segment.end),
      calendarWeekStart: toIsoDate(range.weekStart),
      status: 'SUBMITTED',
      entryIds: entries.map(entry => entry.id),
    },
  });

  return getSubmissionByCompany(client, membership.companyId, submission.id);
}
