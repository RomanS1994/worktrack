import assert from 'node:assert/strict';
import test from 'node:test';

import { getManagerEmployees } from '../services/manager-employees.js';

function context() {
  return {
    activeMembership: {
      id: 'manager-1',
      companyId: 'company-1',
      userId: 'manager-user-1',
      role: 'MANAGER',
      status: 'ACTIVE',
    },
  };
}

function employee(id = 'employee-1') {
  return {
    id,
    userId: `user-${id}`,
    companyId: 'company-1',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    hourlyRateCzk: '300.00',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    user: {
      id: `user-${id}`,
      firstName: 'Anna',
      lastName: 'Novak',
      email: `${id}@example.com`,
    },
    workEntries: [
      { id: `entry-${id}-1`, workDate: new Date('2026-08-24T00:00:00.000Z'), hours: '4.00', status: 'APPROVED' },
      { id: `entry-${id}-2`, workDate: new Date('2026-08-24T00:00:00.000Z'), hours: '5.00', status: 'APPROVED' },
    ],
    weeklySubmissions: [{ id: `submission-${id}` }],
  };
}

test('manager employee list uses company break rules for weekly summaries', async () => {
  const client = {
    company: {
      findUnique: async () => ({ breakMinutes: 60, standardDailyHours: '8.00' }),
    },
    companyMembership: {
      findMany: async query => {
        assert.equal(query.where.companyId, 'company-1');
        return [employee()];
      },
    },
    auditLog: {
      findMany: async () => [],
    },
  };

  const payload = await getManagerEmployees(client, context(), new Date('2026-08-26T12:00:00.000Z'));

  assert.equal(payload.week.weekStart, '2026-08-24');
  assert.equal(payload.workRules.breakMinutes, 60);
  assert.equal(payload.employees[0].summary.totalHours, '8.00');
  assert.equal(payload.employees[0].summary.approvedHours, '8.00');
  assert.equal(payload.employees[0].summary.confirmedSalaryCzk, '2400.00');
  assert.equal(payload.employees[0].pendingSubmissions, 1);
});

test('manager employee list hides memberships archived by delete action', async () => {
  const client = {
    company: {
      findUnique: async () => ({ breakMinutes: 0, standardDailyHours: '8.00' }),
    },
    companyMembership: {
      findMany: async () => [employee('employee-visible'), employee('employee-deleted')],
    },
    auditLog: {
      findMany: async query => {
        assert.equal(query.where.action, 'employee.deleted');
        return [{ entityId: 'employee-deleted' }];
      },
    },
  };

  const payload = await getManagerEmployees(client, context(), new Date('2026-08-26T12:00:00.000Z'));

  assert.deepEqual(payload.employees.map(item => item.id), ['employee-visible']);
});
