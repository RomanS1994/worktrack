import assert from 'node:assert/strict';
import test from 'node:test';

import { updateSubmittedWorkEntryByManager } from '../services/worktrack.js';

function managerContext(overrides = {}) {
  return {
    activeMembership: {
      id: 'manager-membership-1',
      userId: 'manager-user-1',
      companyId: 'company-1',
      role: 'MANAGER',
      status: 'ACTIVE',
      ...overrides,
    },
  };
}

function submittedEntry(overrides = {}) {
  return {
    id: 'entry-1',
    companyId: 'company-1',
    employeeMembershipId: 'employee-membership-1',
    projectId: 'project-1',
    weeklySubmissionId: 'submission-1',
    workDate: new Date('2026-08-13T00:00:00.000Z'),
    hours: '8.00',
    grossHours: '8.50',
    breakMinutes: 30,
    startTime: '07:00',
    endTime: '15:30',
    note: null,
    status: 'SUBMITTED',
    createdAt: new Date('2026-08-13T16:00:00.000Z'),
    updatedAt: new Date('2026-08-13T16:00:00.000Z'),
    weeklySubmission: { id: 'submission-1', status: 'SUBMITTED' },
    project: { id: 'project-1', companyId: 'company-1', name: 'Praha 5', isActive: true },
    employeeMembership: { userId: 'employee-user-1' },
    ...overrides,
  };
}

function clientFor(entry, { breakMinutes = 30 } = {}) {
  const updates = [];
  const audits = [];
  return {
    updates,
    audits,
    workEntry: {
      findUnique: async () => entry,
      findFirst: async () => null,
      update: async ({ data }) => {
        updates.push(data);
        return { ...entry, ...data };
      },
    },
    project: {
      findFirst: async ({ where }) => ({
        id: where.id,
        companyId: where.companyId,
        name: 'Sportcentrum TJ Lokomotiva',
        isActive: true,
      }),
    },
    company: {
      findUnique: async () => ({ breakMinutes }),
    },
    auditLog: {
      create: async ({ data }) => {
        audits.push(data);
        return data;
      },
    },
  };
}

test('manager edits a submitted shift while keeping it in the approval', async () => {
  const entry = submittedEntry();
  const client = clientFor(entry);

  const result = await updateSubmittedWorkEntryByManager(client, managerContext(), entry.id, {
    projectId: 'project-2',
    startTime: '07:00',
    endTime: '18:30',
    note: 'Corrected after comparison',
  });

  assert.equal(client.updates.length, 1);
  assert.equal(client.updates[0].hours, '11.00');
  assert.equal(client.updates[0].grossHours, '11.50');
  assert.equal(client.updates[0].breakMinutes, 30);
  assert.equal(client.updates[0].projectId, 'project-2');
  assert.equal(client.updates[0].weeklySubmissionId, undefined);
  assert.equal(client.updates[0].status, undefined);
  assert.equal(result.hours, '11.00');
  assert.equal(result.weeklySubmissionId, 'submission-1');
  assert.equal(client.audits[0].action, 'work_entry.manager_updated');
  assert.equal(client.audits[0].targetUserId, 'employee-user-1');
});

test('manager cannot edit an entry that is no longer pending review', async () => {
  const entry = submittedEntry({
    status: 'APPROVED',
    weeklySubmission: { id: 'submission-1', status: 'APPROVED' },
  });
  const client = clientFor(entry);

  await assert.rejects(
    updateSubmittedWorkEntryByManager(client, managerContext(), entry.id, { hours: '7.50' }),
    /not pending review/i,
  );
  assert.equal(client.updates.length, 0);
});

test('manager cannot edit a submitted entry from another company', async () => {
  const entry = submittedEntry({ companyId: 'company-2' });
  const client = clientFor(entry);

  await assert.rejects(
    updateSubmittedWorkEntryByManager(client, managerContext(), entry.id, { hours: '7.50' }),
    /not found/i,
  );
  assert.equal(client.updates.length, 0);
});
