import assert from 'node:assert/strict';
import test from 'node:test';

import { getEmployeeWeek, submitEmployeeWeek } from '../services/employee-work.js';

function context() {
  return {
    activeMembership: {
      id: 'employee-1',
      userId: 'user-1',
      companyId: 'company-1',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      hourlyRateCzk: '300.00',
    },
  };
}

function makeEntry(id, date, status = 'DRAFT') {
  return {
    id,
    companyId: 'company-1',
    employeeMembershipId: 'employee-1',
    projectId: 'project-1',
    project: { id: 'project-1', companyId: 'company-1', name: 'Site', isActive: true },
    workDate: new Date(`${date}T00:00:00.000Z`),
    hours: '8.00',
    status,
    weeklySubmissionId: null,
    createdAt: new Date(`${date}T08:00:00.000Z`),
    updatedAt: new Date(`${date}T08:00:00.000Z`),
  };
}

function createClient() {
  const entries = [
    makeEntry('sep-29', '2026-09-29'),
    makeEntry('sep-30', '2026-09-30'),
    makeEntry('oct-01', '2026-10-01'),
    makeEntry('oct-02', '2026-10-02'),
  ];
  const submissions = [];

  const client = {
    auditLog: { create: async () => ({}) },
    workEntry: {
      findMany: async query => {
        if (query.where?.id?.in) return entries.filter(entry => query.where.id.in.includes(entry.id));
        return entries.filter(entry => {
          const date = entry.workDate;
          const range = query.where?.workDate || {};
          const inRange = (!range.gte || date >= range.gte) && (!range.lt || date < range.lt);
          const allowed = query.where?.status?.in ? query.where.status.in.includes(entry.status) : true;
          return inRange && allowed;
        });
      },
      updateMany: async query => {
        for (const entry of entries) {
          if (query.where.id.in.includes(entry.id)) Object.assign(entry, query.data);
        }
        return { count: query.where.id.in.length };
      },
    },
    weeklySubmission: {
      findFirst: async query => submissions.find(item => {
        if (query.where.id && item.id !== query.where.id) return false;
        if (query.where.employeeMembershipId && item.employeeMembershipId !== query.where.employeeMembershipId) return false;
        if (query.where.weekStart instanceof Date && item.weekStart.getTime() !== query.where.weekStart.getTime()) return false;
        if (query.where.weekEnd instanceof Date && item.weekEnd.getTime() !== query.where.weekEnd.getTime()) return false;
        return true;
      }) || null,
      findMany: async query => submissions.filter(item => (
        item.employeeMembershipId === query.where.employeeMembershipId
        && item.weekStart < query.where.weekStart.lt
        && item.weekEnd >= query.where.weekEnd.gte
      )),
      create: async ({ data }) => {
        const item = { ...data, workEntries: [] };
        submissions.push(item);
        return item;
      },
      update: async ({ where, data }) => {
        const item = submissions.find(value => value.id === where.id);
        Object.assign(item, data);
        return item;
      },
    },
  };

  // getSubmissionByCompany needs relations after work entries are attached.
  client.weeklySubmission.findFirst = async query => {
    const item = submissions.find(value => {
      if (query.where.id && value.id !== query.where.id) return false;
      if (query.where.companyId && value.companyId !== query.where.companyId) return false;
      if (query.where.employeeMembershipId && value.employeeMembershipId !== query.where.employeeMembershipId) return false;
      if (query.where.weekStart instanceof Date && value.weekStart.getTime() !== query.where.weekStart.getTime()) return false;
      if (query.where.weekEnd instanceof Date && value.weekEnd.getTime() !== query.where.weekEnd.getTime()) return false;
      return true;
    }) || null;
    if (!item) return null;
    return {
      ...item,
      employeeMembership: { ...context().activeMembership, user: { id: 'user-1', email: 'worker@example.com' } },
      workEntries: entries.filter(entry => entry.weeklySubmissionId === item.id),
    };
  };

  return { client, entries, submissions };
}

test('a week crossing month end is submitted in independent month segments', async () => {
  const { client, entries, submissions } = createClient();

  const september = await submitEmployeeWeek(client, context(), { weekStart: '2026-09-28' });
  assert.equal(september.weekStart, '2026-09-28');
  assert.equal(september.weekEnd, '2026-09-30');
  assert.deepEqual(september.entries.map(entry => entry.id), ['sep-29', 'sep-30']);
  assert.equal(entries.find(entry => entry.id === 'oct-01').status, 'DRAFT');

  submissions[0].status = 'APPROVED';
  for (const entry of entries.filter(entry => entry.weeklySubmissionId === submissions[0].id)) entry.status = 'APPROVED';

  const october = await submitEmployeeWeek(client, context(), { weekStart: '2026-09-28' });
  assert.equal(october.weekStart, '2026-10-01');
  assert.equal(october.weekEnd, '2026-10-04');
  assert.deepEqual(october.entries.map(entry => entry.id), ['oct-01', 'oct-02']);
  assert.equal(submissions.length, 2);
});

test('approved first month segment does not lock remaining draft days in the same calendar week', async () => {
  const { client, entries, submissions } = createClient();
  const first = await submitEmployeeWeek(client, context(), { weekStart: '2026-09-28' });
  submissions[0].status = 'APPROVED';
  for (const entry of entries.filter(entry => entry.weeklySubmissionId === first.id)) entry.status = 'APPROVED';

  const week = await getEmployeeWeek(client, context(), '2026-09-28');
  assert.equal(week.hasEditableEntries, true);
  assert.equal(week.submission, null);
  assert.equal(week.submissions.length, 1);
  assert.equal(week.entries.filter(entry => entry.status === 'DRAFT').length, 2);
});
