import assert from 'node:assert/strict';
import test from 'node:test';

import { getManagerDashboard } from '../services/manager-dashboard.js';

function context() {
  return {
    activeMembership: {
      id: 'manager-1',
      userId: 'manager-user-1',
      companyId: 'company-1',
      role: 'MANAGER',
      status: 'ACTIVE',
    },
    activeCompany: { id: 'company-1', name: 'Acme' },
  };
}

function client() {
  return {
    company: {
      findUnique: async () => ({ breakMinutes: 0, standardDailyHours: '8.00' }),
    },
    project: {
      count: async query => {
        assert.deepEqual(query.where, { companyId: 'company-1', isActive: true });
        return 3;
      },
    },
    weeklySubmission: {
      count: async query => {
        assert.equal(query.where.companyId, 'company-1');
        assert.equal(query.where.status, 'SUBMITTED');
        assert.equal(query.where.weekStart.toISOString(), '2026-08-17T00:00:00.000Z');
        return 1;
      },
    },
    companyMembership: {
      findMany: async query => {
        if (query.include?.workEntries) {
          return [
            {
              id: 'employee-1', userId: 'user-1', companyId: 'company-1', role: 'EMPLOYEE', status: 'ACTIVE', hourlyRateCzk: '200.00', createdAt: new Date(),
              user: { firstName: 'Anna', lastName: 'Novak', email: 'anna@example.com', deletedAt: null },
              workEntries: [{ id: 'e1', workDate: new Date('2026-08-17T00:00:00.000Z'), status: 'APPROVED', hours: '8.00' }],
            },
            {
              id: 'employee-2', userId: 'user-2', companyId: 'company-1', role: 'EMPLOYEE', status: 'ACTIVE', hourlyRateCzk: '300.00', createdAt: new Date(),
              user: { firstName: 'Petr', lastName: 'Dvorak', email: 'petr@example.com', deletedAt: null },
              workEntries: [],
            },
          ];
        }

        assert.equal(query.include.weeklySubmissions.where.weekStart.toISOString(), '2026-08-17T00:00:00.000Z');
        return [
          {
            id: 'employee-1',
            user: { firstName: 'Anna', lastName: 'Novak', email: 'anna@example.com' },
            weeklySubmissions: [{ status: 'APPROVED', submittedAt: new Date('2026-08-18T10:00:00.000Z'), rejectionReason: null }],
          },
          {
            id: 'employee-2',
            user: { firstName: 'Petr', lastName: 'Dvorak', email: 'petr@example.com' },
            weeklySubmissions: [],
          },
          {
            id: 'employee-3',
            user: { firstName: 'Eva', lastName: 'Mala', email: 'eva@example.com' },
            weeklySubmissions: [{ status: 'REJECTED', submittedAt: new Date('2026-08-18T11:00:00.000Z'), rejectionReason: 'Fix Friday' }],
          },
        ];
      },
    },
  };
}

test('manager dashboard is scoped to current week and categorizes employees', async () => {
  const payload = await getManagerDashboard(client(), context(), new Date('2026-08-19T12:00:00.000Z'));

  assert.equal(payload.week.weekStart, '2026-08-17');
  assert.equal(payload.week.weekEnd, '2026-08-23');
  assert.equal(payload.summary.employeeCount, 3);
  assert.equal(payload.summary.activeProjectCount, 3);
  assert.equal(payload.summary.pendingSubmissions, 1);
  assert.equal(payload.summary.notSubmittedCount, 1);
  assert.equal(payload.summary.needsChangesCount, 1);
  assert.equal(payload.summary.confirmedSalaryCzk, '1600.00');
  assert.equal(payload.team.notSubmitted[0].name, 'Petr Dvorak');
  assert.equal(payload.team.needsChanges[0].rejectionReason, 'Fix Friday');
});
