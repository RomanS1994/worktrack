import { randomUUID } from 'node:crypto';

import { hashPassword } from '../auth/tokens.js';
import { createAuditLog } from '../db/prisma-helpers.js';
import { normalizeEmail, normalizeText, nowIso } from '../validation/common.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REVIEWABLE_STATUS = 'SUBMITTED';
const EDITABLE_ENTRY_STATUSES = new Set(['DRAFT', 'REJECTED']);
const WORK_ENTRY_STATUS_VALUES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];
const WEEKLY_SUBMISSION_STATUS_VALUES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];
const MEMBERSHIP_STATUS_VALUES = ['ACTIVE', 'INACTIVE'];

function parseDate(value, message = 'Invalid work date') {
  const raw = normalizeText(value);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00.000Z`)
    : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(message);
  }

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

export function getWeekRange(value = new Date()) {
  const source = value instanceof Date ? value : parseDate(value, 'Invalid week start');
  const dayStart = startOfUtcDay(source);
  const utcDay = dayStart.getUTCDay();
  const mondayOffset = utcDay === 0 ? -6 : 1 - utcDay;
  const weekStart = addDays(dayStart, mondayOffset);
  const nextWeekStart = addDays(weekStart, 7);
  const weekEnd = addDays(weekStart, 6);

  return {
    weekStart,
    weekEnd,
    nextWeekStart,
    days: Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);

      return {
        date,
        dateKey: toIsoDate(date),
        label: WEEKDAY_LABELS[date.getUTCDay()],
      };
    }),
  };
}

export function serializeWeek(range) {
  return {
    weekStart: toIsoDate(range.weekStart),
    weekEnd: toIsoDate(range.weekEnd),
    days: range.days.map(day => ({
      date: day.dateKey,
      label: day.label,
    })),
  };
}

function normalizeHoursString(value) {
  const raw = String(value ?? '').trim().replace(',', '.');

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error('Invalid hours value');
  }

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 24) {
    throw new Error('Invalid hours value');
  }

  return amount.toFixed(2);
}

function normalizeMoneyString(value, { allowNull = false } = {}) {
  const raw = String(value ?? '').trim().replace(',', '.');

  if (!raw && allowNull) {
    return null;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error('Invalid hourly rate');
  }

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Invalid hourly rate');
  }

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
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');

  return `${sign}${whole}.${fraction}`;
}

function salaryCentsFromHoursAndRate(hourHundredths, rateCents) {
  return Math.round((hourHundredths * rateCents) / 100);
}

function isPendingStatus(status) {
  return status === 'DRAFT' || status === 'SUBMITTED';
}

export function calculateWorkSummary(entries = [], hourlyRateCzk = '0') {
  const rateCents = decimalToHundredths(hourlyRateCzk);
  let totalHourHundredths = 0;
  let approvedHourHundredths = 0;
  let pendingHourHundredths = 0;

  for (const entry of entries) {
    const hourHundredths = decimalToHundredths(entry.hours);
    totalHourHundredths += hourHundredths;

    if (entry.status === 'APPROVED') {
      approvedHourHundredths += hourHundredths;
    } else if (isPendingStatus(entry.status)) {
      pendingHourHundredths += hourHundredths;
    }
  }

  return {
    totalHours: formatHundredths(totalHourHundredths),
    approvedHours: formatHundredths(approvedHourHundredths),
    pendingHours: formatHundredths(pendingHourHundredths),
    confirmedSalaryCzk: formatHundredths(
      salaryCentsFromHoursAndRate(approvedHourHundredths, rateCents)
    ),
    predictedSalaryCzk: formatHundredths(
      salaryCentsFromHoursAndRate(pendingHourHundredths, rateCents)
    ),
  };
}

function getActiveMembership(context) {
  return context?.activeMembership || context?.membership || context || null;
}

function getContextUser(context) {
  return context?.user || getActiveMembership(context)?.user || null;
}

function ensureCompanyContext(context) {
  const membership = getActiveMembership(context);

  if (!membership?.companyId || membership.status === 'INACTIVE') {
    throw new Error('Company access is required');
  }

  return membership;
}

function ensureManagerContext(context) {
  const membership = ensureCompanyContext(context);

  if (membership.role !== 'MANAGER') {
    throw new Error('Manager access is required');
  }

  return membership;
}

function ensureEmployeeContext(context) {
  const membership = ensureCompanyContext(context);

  if (membership.role !== 'EMPLOYEE') {
    throw new Error('Employee access is required');
  }

  return membership;
}

function serializeCompany(company) {
  if (!company) return null;

  return {
    id: company.id,
    name: normalizeText(company.name),
    slug: normalizeText(company.slug),
  };
}

export function serializeProject(project) {
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
    pendingSubmissions: Array.isArray(membership.weeklySubmissions)
      ? membership.weeklySubmissions.length
      : 0,
    user: serializeUserSummary(user),
    email: user?.email || '',
    firstName: normalizeText(user?.firstName),
    lastName: normalizeText(user?.lastName),
    name: normalizeText(user?.name) || user?.email || '',
    summary: calculateWorkSummary(entries, membership.hourlyRateCzk ?? '0'),
  };
}

export function serializeWorkEntry(entry) {
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

export function serializeWeeklySubmission(submission) {
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

function ensureSubmissionCanBeSubmitted(submission) {
  if (!submission) return;

  if (submission.status === 'SUBMITTED') {
    throw new Error('Weekly submission is already submitted');
  }

  if (submission.status === 'APPROVED') {
    throw new Error('Weekly submission is already approved');
  }
}

function ensureEntryEditable(entry) {
  if (!entry || !EDITABLE_ENTRY_STATUSES.has(entry.status)) {
    throw new Error('Work entry is locked');
  }

  if (
    entry.weeklySubmission &&
    ['SUBMITTED', 'APPROVED'].includes(entry.weeklySubmission.status)
  ) {
    throw new Error('Work entry is locked');
  }
}

async function findWeekSubmission(client, employeeMembershipId, range) {
  return client.weeklySubmission.findUnique({
    where: {
      employeeMembershipId_weekStart: {
        employeeMembershipId,
        weekStart: range.weekStart,
      },
    },
  });
}

async function ensureWeekOpenForEditing(client, employeeMembershipId, range) {
  const submission = await findWeekSubmission(client, employeeMembershipId, range);

  if (submission && ['SUBMITTED', 'APPROVED'].includes(submission.status)) {
    throw new Error('Weekly submission is locked');
  }

  return submission;
}

async function findProjectInCompany(client, companyId, projectId, { requireActive = true } = {}) {
  const id = normalizeText(projectId);

  if (!id) {
    throw new Error('Project is required');
  }

  const project = await client.project.findFirst({
    where: {
      id,
      companyId,
      ...(requireActive ? { isActive: true } : {}),
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  return project;
}

function normalizeProjectInput(payload = {}) {
  const name = normalizeText(payload.name);

  if (!name) {
    throw new Error('Project name is required');
  }

  return {
    name,
    address: normalizeText(payload.address) || null,
    description: normalizeText(payload.description) || null,
  };
}

function normalizeSubmissionStatusFilter(value) {
  const status = normalizeText(value).toUpperCase();

  if (!status || status === 'ALL') {
    return '';
  }

  if (!WEEKLY_SUBMISSION_STATUS_VALUES.includes(status)) {
    throw new Error('Invalid weekly submission status');
  }

  return status;
}

export async function getCompanySettings(client, context) {
  const membership = ensureManagerContext(context);
  const company = await client.company.findUnique({
    where: {
      id: membership.companyId,
    },
  });

  if (!company) {
    throw new Error('Company not found');
  }

  return {
    company: serializeCompany(company),
  };
}

export async function updateCompanySettings(client, context, payload = {}) {
  const membership = ensureManagerContext(context);
  const name = normalizeText(payload.name);

  if (!name) {
    throw new Error('Company name is required');
  }

  const company = await client.company.update({
    where: {
      id: membership.companyId,
    },
    data: {
      name,
      updatedAt: new Date(nowIso()),
    },
  });

  await createAuditLog(client, {
    action: 'company.updated',
    actorUserId: membership.userId,
    entityType: 'company',
    entityId: company.id,
    after: serializeCompany(company),
  });

  return {
    company: serializeCompany(company),
  };
}

export async function listProjects(client, context) {
  const membership = ensureCompanyContext(context);
  const projects = await client.project.findMany({
    where: {
      companyId: membership.companyId,
      ...(membership.role === 'EMPLOYEE' ? { isActive: true } : {}),
    },
    orderBy: [
      {
        isActive: 'desc',
      },
      {
        name: 'asc',
      },
    ],
  });

  return {
    projects: projects.map(serializeProject),
  };
}

export async function createProject(client, context, payload = {}) {
  const membership = ensureManagerContext(context);
  const input = normalizeProjectInput(payload);
  const timestamp = new Date(nowIso());
  const project = await client.project.create({
    data: {
      id: randomUUID(),
      companyId: membership.companyId,
      ...input,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  });

  await createAuditLog(client, {
    action: 'project.created',
    actorUserId: membership.userId,
    entityType: 'project',
    entityId: project.id,
    after: serializeProject(project),
  });

  return serializeProject(project);
}

export async function updateProject(client, context, projectId, payload = {}) {
  const membership = ensureManagerContext(context);
  const existing = await findProjectInCompany(client, membership.companyId, projectId, {
    requireActive: false,
  });
  const input = normalizeProjectInput({
    ...existing,
    ...payload,
  });
  const data = {
    ...input,
    updatedAt: new Date(nowIso()),
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'isActive')) {
    data.isActive = Boolean(payload.isActive);
  }

  const project = await client.project.update({
    where: {
      id: existing.id,
    },
    data,
  });

  await createAuditLog(client, {
    action: 'project.updated',
    actorUserId: membership.userId,
    entityType: 'project',
    entityId: project.id,
    before: serializeProject(existing),
    after: serializeProject(project),
  });

  return serializeProject(project);
}

export async function deactivateProject(client, context, projectId) {
  return updateProject(client, context, projectId, {
    isActive: false,
  });
}

export async function getEmployeeWeek(client, context, weekStartInput) {
  const membership = ensureEmployeeContext(context);
  const range = getWeekRange(weekStartInput || new Date());

  const [entries, submission] = await Promise.all([
    client.workEntry.findMany({
      where: {
        companyId: membership.companyId,
        employeeMembershipId: membership.id,
        workDate: {
          gte: range.weekStart,
          lt: range.nextWeekStart,
        },
      },
      include: {
        project: true,
      },
      orderBy: [
        {
          workDate: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    }),
    findWeekSubmission(client, membership.id, range),
  ]);

  return {
    week: serializeWeek(range),
    entries: entries.map(serializeWorkEntry),
    submission: serializeWeeklySubmission(submission),
    summary: calculateWorkSummary(entries, membership.hourlyRateCzk ?? '0'),
  };
}

export async function createEmployeeWorkEntry(client, context, payload = {}) {
  const membership = ensureEmployeeContext(context);
  const workDate = startOfUtcDay(parseDate(payload.workDate));
  const range = getWeekRange(workDate);
  await ensureWeekOpenForEditing(client, membership.id, range);
  const project = await findProjectInCompany(client, membership.companyId, payload.projectId);

  const existing = await client.workEntry.findFirst({
    where: {
      companyId: membership.companyId,
      employeeMembershipId: membership.id,
      projectId: project.id,
      workDate,
    },
  });

  if (existing) {
    throw new Error('Work entry already exists');
  }

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
    include: {
      project: true,
    },
  });

  await createAuditLog(client, {
    action: 'work_entry.created',
    actorUserId: membership.userId,
    targetUserId: membership.userId,
    entityType: 'work_entry',
    entityId: entry.id,
    after: serializeWorkEntry(entry),
  });

  return serializeWorkEntry(entry);
}

export async function updateEmployeeWorkEntry(client, context, entryId, payload = {}) {
  const membership = ensureEmployeeContext(context);

  const existing = await client.workEntry.findUnique({
    where: {
      id: entryId,
    },
    include: {
      weeklySubmission: true,
      project: true,
    },
  });

  if (
    !existing ||
    existing.companyId !== membership.companyId ||
    existing.employeeMembershipId !== membership.id
  ) {
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
      id: {
        not: existing.id,
      },
    },
  });

  if (duplicate) {
    throw new Error('Work entry already exists');
  }

  const entry = await client.workEntry.update({
    where: {
      id: existing.id,
    },
    data: {
      projectId,
      hours: normalizeHoursString(payload.hours),
      status: 'DRAFT',
      weeklySubmissionId: null,
      updatedAt: new Date(nowIso()),
    },
    include: {
      project: true,
    },
  });

  await createAuditLog(client, {
    action: 'work_entry.updated',
    actorUserId: membership.userId,
    targetUserId: membership.userId,
    entityType: 'work_entry',
    entityId: entry.id,
    before: serializeWorkEntry(existing),
    after: serializeWorkEntry(entry),
  });

  return serializeWorkEntry(entry);
}

export async function deleteEmployeeWorkEntry(client, context, entryId) {
  const membership = ensureEmployeeContext(context);

  const existing = await client.workEntry.findUnique({
    where: {
      id: entryId,
    },
    include: {
      weeklySubmission: true,
      project: true,
    },
  });

  if (
    !existing ||
    existing.companyId !== membership.companyId ||
    existing.employeeMembershipId !== membership.id
  ) {
    throw new Error('Work entry not found');
  }

  ensureEntryEditable(existing);

  await client.workEntry.delete({
    where: {
      id: existing.id,
    },
  });

  await createAuditLog(client, {
    action: 'work_entry.deleted',
    actorUserId: membership.userId,
    targetUserId: membership.userId,
    entityType: 'work_entry',
    entityId: existing.id,
    before: serializeWorkEntry(existing),
  });

  return { ok: true };
}

async function getSubmissionByCompany(client, companyId, submissionId, notFoundMessage) {
  const submission = await client.weeklySubmission.findFirst({
    where: {
      id: submissionId,
      companyId,
    },
    include: {
      employeeMembership: {
        include: {
          user: true,
        },
      },
      workEntries: {
        include: {
          project: true,
        },
        orderBy: {
          workDate: 'asc',
        },
      },
    },
  });

  if (!submission) {
    throw new Error(notFoundMessage);
  }

  return serializeWeeklySubmission(submission);
}

export async function submitEmployeeWeek(client, context, payload = {}) {
  const membership = ensureEmployeeContext(context);
  const range = getWeekRange(payload.weekStart || new Date());
  const timestamp = new Date(nowIso());
  const existingSubmission = await findWeekSubmission(client, membership.id, range);
  ensureSubmissionCanBeSubmitted(existingSubmission);

  const entries = await client.workEntry.findMany({
    where: {
      companyId: membership.companyId,
      employeeMembershipId: membership.id,
      workDate: {
        gte: range.weekStart,
        lt: range.nextWeekStart,
      },
      status: {
        in: ['DRAFT', 'REJECTED'],
      },
    },
    orderBy: {
      workDate: 'asc',
    },
  });

  if (!entries.length) {
    throw new Error('No work entries to submit');
  }

  const submission = existingSubmission
    ? await client.weeklySubmission.update({
        where: {
          id: existingSubmission.id,
        },
        data: {
          status: 'SUBMITTED',
          submittedAt: timestamp,
          reviewedAt: null,
          reviewedByMembershipId: null,
          rejectionReason: null,
          weekEnd: range.weekEnd,
          updatedAt: timestamp,
        },
      })
    : await client.weeklySubmission.create({
        data: {
          id: randomUUID(),
          companyId: membership.companyId,
          employeeMembershipId: membership.id,
          reviewedByMembershipId: null,
          weekStart: range.weekStart,
          weekEnd: range.weekEnd,
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
      id: {
        in: entries.map(entry => entry.id),
      },
      companyId: membership.companyId,
      employeeMembershipId: membership.id,
    },
    data: {
      weeklySubmissionId: submission.id,
      status: 'SUBMITTED',
      updatedAt: timestamp,
    },
  });

  await createAuditLog(client, {
    action: 'weekly_submission.submitted',
    actorUserId: membership.userId,
    targetUserId: membership.userId,
    entityType: 'weekly_submission',
    entityId: submission.id,
    after: {
      companyId: membership.companyId,
      weekStart: toIsoDate(range.weekStart),
      status: 'SUBMITTED',
      entryIds: entries.map(entry => entry.id),
    },
  });

  return getSubmissionByCompany(
    client,
    membership.companyId,
    submission.id,
    'Weekly submission not found'
  );
}

export async function listManagerEmployees(client, context) {
  const membership = ensureManagerContext(context);
  const range = getWeekRange(new Date());
  const employees = await client.companyMembership.findMany({
    where: {
      companyId: membership.companyId,
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
            gte: range.weekStart,
            lt: range.nextWeekStart,
          },
        },
        orderBy: {
          workDate: 'asc',
        },
      },
      weeklySubmissions: {
        where: {
          status: 'SUBMITTED',
        },
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return {
    week: serializeWeek(range),
    employees: employees.map(serializeEmployeeMembership),
  };
}

export async function createManagerEmployee(client, context, payload = {}) {
  const managerMembership = ensureManagerContext(context);
  const firstName = normalizeText(payload.firstName);
  const lastName = normalizeText(payload.lastName);
  const email = normalizeEmail(payload.email);
  const temporaryPassword = String(payload.temporaryPassword || payload.password || '');
  const hourlyRateCzk = normalizeMoneyString(payload.hourlyRateCzk);

  if (!firstName) {
    throw new Error('First name is required');
  }

  if (!lastName) {
    throw new Error('Last name is required');
  }

  if (!email) {
    throw new Error('Email is required');
  }

  const existingUser = await client.user.findUnique({
    where: {
      email,
    },
  });

  if (existingUser) {
    const existingMembership = await client.companyMembership.findUnique({
      where: {
        companyId_userId: {
          companyId: managerMembership.companyId,
          userId: existingUser.id,
        },
      },
    });

    if (existingMembership) {
      throw new Error('Employee already belongs to this company');
    }
  } else if (temporaryPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  const timestamp = new Date(nowIso());
  const user =
    existingUser ||
    (await client.user.create({
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
    }));

  const membership = await client.companyMembership.create({
    data: {
      id: randomUUID(),
      companyId: managerMembership.companyId,
      userId: user.id,
      role: 'EMPLOYEE',
      hourlyRateCzk,
      status: 'ACTIVE',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    include: {
      user: true,
      workEntries: true,
      weeklySubmissions: true,
    },
  });

  await createAuditLog(client, {
    action: 'employee.created',
    actorUserId: managerMembership.userId,
    targetUserId: user.id,
    entityType: 'company_membership',
    entityId: membership.id,
    after: {
      companyId: managerMembership.companyId,
      role: membership.role,
      hourlyRateCzk: membership.hourlyRateCzk,
    },
  });

  return serializeEmployeeMembership(membership);
}

export async function updateEmployeeMembership(client, context, employeeMembershipId, payload = {}) {
  const managerMembership = ensureManagerContext(context);
  const existing = await client.companyMembership.findFirst({
    where: {
      id: employeeMembershipId,
      companyId: managerMembership.companyId,
      role: 'EMPLOYEE',
    },
    include: {
      user: true,
    },
  });

  if (!existing) {
    throw new Error('Employee not found');
  }

  const data = {
    updatedAt: new Date(nowIso()),
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'hourlyRateCzk')) {
    data.hourlyRateCzk = normalizeMoneyString(payload.hourlyRateCzk);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    const status = normalizeText(payload.status).toUpperCase();

    if (!MEMBERSHIP_STATUS_VALUES.includes(status)) {
      throw new Error('Invalid membership status');
    }

    data.status = status;
  }

  const membership = await client.companyMembership.update({
    where: {
      id: existing.id,
    },
    data,
    include: {
      user: true,
      workEntries: true,
      weeklySubmissions: true,
    },
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
      ...(status ? { status } : {}),
      employeeMembership: {
        is: {
          role: 'EMPLOYEE',
          user: {
            is: {
              deletedAt: null,
            },
          },
        },
      },
    },
    include: {
      employeeMembership: {
        include: {
          user: true,
        },
      },
      workEntries: {
        include: {
          project: true,
        },
        orderBy: {
          workDate: 'asc',
        },
      },
    },
    orderBy: [
      {
        submittedAt: 'desc',
      },
      {
        weekStart: 'desc',
      },
    ],
  });

  return {
    submissions: submissions.map(serializeWeeklySubmission),
  };
}

export async function getManagerSubmissionById(
  client,
  context,
  submissionId,
  { notFoundMessage = 'Weekly submission not found' } = {}
) {
  const membership = ensureManagerContext(context);
  return getSubmissionByCompany(client, membership.companyId, submissionId, notFoundMessage);
}

export async function reviewWeeklySubmission(
  client,
  context,
  submissionId,
  decision,
  payload = {}
) {
  const managerMembership = ensureManagerContext(context);
  const nextStatus = decision === 'approve' ? 'APPROVED' : 'REJECTED';
  const rejectionReason =
    nextStatus === 'REJECTED' ? normalizeText(payload.rejectionReason).slice(0, 500) : '';
  const submission = await client.weeklySubmission.findFirst({
    where: {
      id: submissionId,
      companyId: managerMembership.companyId,
      employeeMembership: {
        is: {
          role: 'EMPLOYEE',
          user: {
            is: {
              deletedAt: null,
            },
          },
        },
      },
    },
    include: {
      employeeMembership: {
        include: {
          user: true,
        },
      },
      workEntries: {
        include: {
          project: true,
        },
      },
    },
  });

  if (!submission) {
    throw new Error('Weekly submission not found');
  }

  if (submission.status !== REVIEWABLE_STATUS) {
    throw new Error('Weekly submission is not pending review');
  }

  const timestamp = new Date(nowIso());

  await client.workEntry.updateMany({
    where: {
      companyId: managerMembership.companyId,
      weeklySubmissionId: submission.id,
    },
    data: {
      status: nextStatus,
      updatedAt: timestamp,
    },
  });

  await client.weeklySubmission.update({
    where: {
      id: submission.id,
    },
    data: {
      status: nextStatus,
      reviewedByMembershipId: managerMembership.id,
      reviewedAt: timestamp,
      rejectionReason: nextStatus === 'REJECTED' ? rejectionReason || null : null,
      updatedAt: timestamp,
    },
  });

  await createAuditLog(client, {
    action:
      nextStatus === 'APPROVED'
        ? 'weekly_submission.approved'
        : 'weekly_submission.rejected',
    actorUserId: managerMembership.userId,
    targetUserId: submission.employeeMembership?.userId || null,
    entityType: 'weekly_submission',
    entityId: submission.id,
    before: {
      status: submission.status,
    },
    after: {
      status: nextStatus,
      reviewedByMembershipId: managerMembership.id,
      rejectionReason: nextStatus === 'REJECTED' ? rejectionReason : '',
    },
  });

  return getSubmissionByCompany(client, managerMembership.companyId, submission.id);
}

export async function getEmployeeDashboardSummary(client, context, weekStartInput) {
  const membership = ensureEmployeeContext(context);
  const weekData = await getEmployeeWeek(client, context, weekStartInput);

  return {
    role: 'EMPLOYEE',
    company: serializeCompany(membership.company || context.activeCompany),
    week: weekData.week,
    submission: weekData.submission,
    summary: weekData.summary,
  };
}

export async function getManagerDashboardSummary(client, context) {
  const membership = ensureManagerContext(context);
  const [employeeCount, activeProjectCount, pendingSubmissions, entries] = await Promise.all([
    client.companyMembership.count({
      where: {
        companyId: membership.companyId,
        role: 'EMPLOYEE',
        status: 'ACTIVE',
        user: {
          is: {
            deletedAt: null,
          },
        },
      },
    }),
    client.project.count({
      where: {
        companyId: membership.companyId,
        isActive: true,
      },
    }),
    client.weeklySubmission.count({
      where: {
        companyId: membership.companyId,
        status: 'SUBMITTED',
      },
    }),
    client.workEntry.findMany({
      where: {
        companyId: membership.companyId,
        status: {
          in: ['SUBMITTED', 'APPROVED'],
        },
      },
      include: {
        employeeMembership: true,
      },
    }),
  ]);

  let approvedHourHundredths = 0;
  let pendingHourHundredths = 0;
  let confirmedSalaryCents = 0;
  let predictedSalaryCents = 0;

  for (const entry of entries) {
    const hourHundredths = decimalToHundredths(entry.hours);
    const rateCents = decimalToHundredths(entry.employeeMembership?.hourlyRateCzk ?? '0');

    if (entry.status === 'APPROVED') {
      approvedHourHundredths += hourHundredths;
      confirmedSalaryCents += salaryCentsFromHoursAndRate(hourHundredths, rateCents);
    } else if (entry.status === 'SUBMITTED') {
      pendingHourHundredths += hourHundredths;
      predictedSalaryCents += salaryCentsFromHoursAndRate(hourHundredths, rateCents);
    }
  }

  return {
    role: 'MANAGER',
    company: serializeCompany(membership.company || context.activeCompany),
    summary: {
      employeeCount,
      activeProjectCount,
      pendingSubmissions,
      approvedHours: formatHundredths(approvedHourHundredths),
      pendingHours: formatHundredths(pendingHourHundredths),
      confirmedSalaryCzk: formatHundredths(confirmedSalaryCents),
      predictedSalaryCzk: formatHundredths(predictedSalaryCents),
    },
  };
}

export function isValidWorkEntryStatus(value) {
  return WORK_ENTRY_STATUS_VALUES.includes(normalizeText(value).toUpperCase());
}
