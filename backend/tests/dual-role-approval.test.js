import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listManagerSubmissions,
  reviewWeeklySubmission,
  updateSubmittedWorkEntryByManager,
} from '../services/manager-workflow.js';
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

test('manager approval list excludes the manager own employee submission', async () => {
  let query;
  const client = {
    weeklySubmission: {
      findMany: async args => {
        query = args;
        return [];
      },
    },
  };

  const result = await listManagerSubmissions(client, managerContext(), { status: 'SUBMITTED' });

  assert.deepEqual(result, { submissions: [] });
  assert.deepEqual(query.where.employeeMembershipId, { not: 'manager-membership-1' });
  assert.equal(query.where.companyId, 'company-1');
  assert.equal(query.where.status, 'SUBMITTED');
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
