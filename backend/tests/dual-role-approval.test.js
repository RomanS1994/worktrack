import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listManagerSubmissions,
  reviewWeeklySubmission,
  updateSubmittedWorkEntryByManager,
} from '../services/manager-workflow.js';
import { upsertManagerTimesheetCell } from '../services/manager-timesheet.js';
import { notifyManagersAboutSubmission } from '../services/notifications.js';

function managerContext() {
  return {
    user: { id: 'manager-user-1', name: 'Roman' },
    activeMembership: {
      id: 'manager-membership-1',
      userId: 'manager-user-1',
      companyId: 'company-1',
      role: 'MANAGER',
      status: 'ACTIVE',
    },
  };
}

function submission(id, employeeMembershipId, userId) {
  return {
    id,
    companyId: 'company-1',
    employeeMembershipId,
    reviewedByMembershipId: null,
    weekStart: new Date('2026-09-01T00:00:00.000Z'),
    weekEnd: new Date('2026-09-06T00:00:00.000Z'),
    status: 'SUBMITTED',
    submittedAt: new Date('2026-09-06T12:00:00.000Z'),
    reviewedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-09-06T12:00:00.000Z'),
    updatedAt: new Date('2026-09-06T12:00:00.000Z'),
    employeeMembership: {
      id: employeeMembershipId,
      userId,
      companyId: 'company-1',
      role: 'MANAGER',
      status: 'ACTIVE',
      hourlyRateCzk: '250.00',
      user: { id: userId, name: userId, email: `${userId}@example.com` },
    },
    workEntries: [],
  };
}

test('manager approval list excludes the manager own employee submission', async () => {
  let query;
  const client = {
    weeklySubmission: {
      findMany: async args => {
        query = args;
        return [
          submission('own-submission', 'manager-membership-1', 'manager-user-1'),
          submission('other-submission', 'manager-membership-2', 'manager-user-2'),
        ];
      },
    },
  };

  const result = await listManagerSubmissions(client, managerContext(), { status: 'SUBMITTED' });

  assert.equal(query.where.companyId, 'company-1');
  assert.equal(query.where.status, 'SUBMITTED');
  assert.equal(result.submissions.length, 1);
  assert.equal(result.submissions[0].id, 'other-submission');
});

test('manager cannot approve their own submitted week', async () => {
  let workEntriesUpdated = false;
  let submissionUpdated = false;
  const client = {
    weeklySubmission: {
      findFirst: async () => ({
        id: 'submission-1',
        companyId: 'company-1',
        employeeMembershipId: 'manager-membership-1',
        status: 'SUBMITTED',
        employeeMembership: { userId: 'manager-user-1', user: { id: 'manager-user-1' } },
        workEntries: [],
      }),
      update: async () => {
        submissionUpdated = true;
      },
    },
    workEntry: {
      updateMany: async () => {
        workEntriesUpdated = true;
      },
    },
  };

  await assert.rejects(
    reviewWeeklySubmission(client, managerContext(), 'submission-1', 'approve'),
    /cannot review their own submission/i,
  );
  assert.equal(workEntriesUpdated, false);
  assert.equal(submissionUpdated, false);
});

test('manager cannot edit their own submitted entry through approval tools', async () => {
  let updated = false;
  const client = {
    workEntry: {
      findUnique: async () => ({
        id: 'entry-1',
        companyId: 'company-1',
        employeeMembershipId: 'manager-membership-1',
        status: 'SUBMITTED',
        weeklySubmission: { id: 'submission-1', status: 'SUBMITTED' },
        employeeMembership: { userId: 'manager-user-1' },
      }),
      update: async () => {
        updated = true;
      },
    },
  };

  await assert.rejects(
    updateSubmittedWorkEntryByManager(client, managerContext(), 'entry-1', { hours: '8.00' }),
    /cannot review their own submission/i,
  );
  assert.equal(updated, false);
});

test('manager can write the control timesheet for their own employee row', async () => {
  let created = false;
  const workDate = new Date('2026-09-03T00:00:00.000Z');
  const client = {
    companyMembership: {
      findFirst: async () => ({ id: 'manager-membership-1' }),
    },
    managerTimesheetEntry: {
      findUnique: async () => null,
      create: async ({ data }) => {
        created = true;
        return {
          ...data,
          id: 'manager-entry-1',
          workDate,
        };
      },
    },
  };

  const result = await upsertManagerTimesheetCell(client, managerContext(), 'manager-membership-1', {
    date: '2026-09-03',
    hours: '8',
  });

  assert.equal(created, true);
  assert.equal(result.entry.employeeMembershipId, 'manager-membership-1');
  assert.equal(result.entry.workDate, '2026-09-03');
  assert.equal(result.entry.hours, 8);
});

test('manager submitter is excluded from manager submission notifications', async () => {
  let managerQuery;
  const createdRecipients = [];
  const client = {
    companyMembership: {
      findMany: async args => {
        managerQuery = args;
        return [{ id: 'manager-membership-2' }];
      },
      findUnique: async () => null,
    },
    notification: {
      create: async ({ data }) => {
        createdRecipients.push(data.recipientMembershipId);
        return { ...data, createdAt: new Date(), readAt: null };
      },
    },
  };

  await notifyManagersAboutSubmission(client, managerContext(), {
    weekStart: '2026-09-01',
    weekEnd: '2026-09-06',
    employee: { name: 'Roman' },
  });

  assert.deepEqual(managerQuery.where.id, { not: 'manager-membership-1' });
  assert.deepEqual(createdRecipients, ['manager-membership-2']);
});
