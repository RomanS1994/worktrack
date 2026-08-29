import assert from 'node:assert/strict';
import test from 'node:test';

import { getManagerPayroll } from '../services/manager-payroll.js';

function createManagerContext() {
  return {
    activeMembership: {
      id: 'manager-membership-1',
      userId: 'manager-user-1',
      companyId: 'company-1',
      role: 'MANAGER',
      status: 'ACTIVE',
    },
    activeCompany: {
      id: 'company-1',
      name: 'Test Company',
    },
  };
}

function createClient({ onFindMany, breakMinutes = 0, standardDailyHours = '8.00', memberships, advances = [] } = {}) {
  return {
    company: {
      findUnique: async () => ({ breakMinutes, standardDailyHours }),
    },
    salaryAdvance: {
      findMany: async () => advances,
    },
    companyMembership: {
      findMany: async query => {
        onFindMany?.(query);
        if (memberships) return memberships;
        return [
          {
            id: 'employee-membership-1',
            userId: 'employee-user-1',
            companyId: 'company-1',
            role: 'EMPLOYEE',
            status: 'ACTIVE',
            hourlyRateCzk: '200.00',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            user: {
              id: 'employee-user-1',
              firstName: 'Anna',
              lastName: 'Novak',
              name: 'Anna Novak',
              email: 'anna@example.com',
              deletedAt: null,
            },
            workEntries: [
              { id: 'a1', workDate: new Date('2026-08-17T00:00:00.000Z'), status: 'APPROVED', hours: '8.00' },
              { id: 'a2', workDate: new Date('2026-08-18T00:00:00.000Z'), status: 'SUBMITTED', hours: '4.00' },
              { id: 'a3', workDate: new Date('2026-08-18T00:00:00.000Z'), status: 'DRAFT', hours: '2.00' },
            ],
          },
          {
            id: 'employee-membership-2',
            userId: 'employee-user-2',
            companyId: 'company-1',
            role: 'EMPLOYEE',
            status: 'INACTIVE',
            hourlyRateCzk: '300.00',
            createdAt: new Date('2026-01-02T00:00:00.000Z'),
            user: {
              id: 'employee-user-2',
              firstName: 'Petra',
              lastName: 'Svobodova',
              name: 'Petra Svobodova',
              email: 'petra@example.com',
              deletedAt: null,
            },
            workEntries: [{ id: 'b1', workDate: new Date('2026-08-17T00:00:00.000Z'), status: 'APPROVED', hours: '5.00' }],
          },
        ];
      },
    },
  };
}

test('manager payroll calculates a selected week and employee breakdown', async () => {
  let query = null;
  const client = createClient({ onFindMany: value => (query = value) });

  const payload = await getManagerPayroll(client, createManagerContext(), {
    period: 'week',
    anchor: '2026-08-18',
  });

  assert.deepEqual(payload.period, {
    type: 'week',
    anchor: '2026-08-18',
    start: '2026-08-17',
    end: '2026-08-23',
  });
  assert.equal(query.where.companyId, 'company-1');
  assert.equal(query.where.role, 'EMPLOYEE');
  assert.equal(query.include.workEntries.where.workDate.gte.toISOString(), '2026-08-17T00:00:00.000Z');
  assert.equal(query.include.workEntries.where.workDate.lt.toISOString(), '2026-08-24T00:00:00.000Z');
  assert.deepEqual(query.include.workEntries.where.status.in, ['DRAFT', 'SUBMITTED', 'APPROVED']);

  assert.equal(payload.employees[0].name, 'Anna Novak');
  assert.deepEqual(payload.employees[0].summary, {
    totalHours: '14.00',
    approvedHours: '8.00',
    pendingHours: '6.00',
    confirmedSalaryCzk: '1600.00',
    predictedSalaryCzk: '1200.00',
    advancesCzk: '0.00',
    netPayCzk: '1200.00',
  });
  assert.equal(payload.employees[1].status, 'INACTIVE');
  assert.deepEqual(payload.summary, {
    employeeCount: 2,
    employeesWithHours: 2,
    approvedHours: '13.00',
    pendingHours: '6.00',
    confirmedSalaryCzk: '3100.00',
    predictedSalaryCzk: '1200.00',
    advancesCzk: '0.00',
    netPayCzk: '1200.00',
  });
});

test('manager payroll deducts lunch once per employee work day', async () => {
  const payload = await getManagerPayroll(
    createClient({ breakMinutes: 60 }),
    createManagerContext(),
    { period: 'week', anchor: '2026-08-18' }
  );

  assert.deepEqual(payload.employees[0].summary, {
    totalHours: '12.00',
    approvedHours: '7.00',
    pendingHours: '5.00',
    confirmedSalaryCzk: '1400.00',
    predictedSalaryCzk: '1000.00',
    advancesCzk: '0.00',
    netPayCzk: '1000.00',
  });
  assert.equal(payload.employees[1].summary.totalHours, '4.00');
  assert.equal(payload.workRules.breakMinutes, 60);
  assert.equal(payload.workRules.standardDailyHours, '8.00');
});

test('manager payroll uses the rate snapshot stored on each work entry', async () => {
  const payload = await getManagerPayroll(
    createClient({
      memberships: [
        {
          id: 'employee-membership-1',
          userId: 'employee-user-1',
          companyId: 'company-1',
          role: 'EMPLOYEE',
          status: 'ACTIVE',
          hourlyRateCzk: '300.00',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          user: { firstName: 'Anna', lastName: 'Novak', email: 'anna@example.com', deletedAt: null },
          workEntries: [
            { id: 'old-rate', workDate: new Date('2026-08-17T00:00:00.000Z'), status: 'APPROVED', hours: '8.00', hourlyRateCzk: '200.00' },
            { id: 'new-rate', workDate: new Date('2026-08-18T00:00:00.000Z'), status: 'APPROVED', hours: '8.00', hourlyRateCzk: '300.00' },
          ],
        },
      ],
    }),
    createManagerContext(),
    { period: 'week', anchor: '2026-08-18' }
  );

  assert.equal(payload.summary.approvedHours, '16.00');
  assert.equal(payload.summary.confirmedSalaryCzk, '4000.00');
});

test('manager payroll excludes inactive employees with no hours in the selected period', async () => {
  const payload = await getManagerPayroll(
    createClient({
      memberships: [
        {
          id: 'active', userId: 'active-user', companyId: 'company-1', role: 'EMPLOYEE', status: 'ACTIVE', hourlyRateCzk: '200.00', createdAt: new Date(),
          user: { firstName: 'Active', lastName: 'Worker', email: 'active@example.com', deletedAt: null },
          workEntries: [],
        },
        {
          id: 'inactive', userId: 'inactive-user', companyId: 'company-1', role: 'EMPLOYEE', status: 'INACTIVE', hourlyRateCzk: '200.00', createdAt: new Date(),
          user: { firstName: 'Former', lastName: 'Worker', email: 'former@example.com', deletedAt: null },
          workEntries: [],
        },
      ],
    }),
    createManagerContext(),
    { period: 'week', anchor: '2026-08-18' }
  );

  assert.equal(payload.summary.employeeCount, 1);
  assert.equal(payload.employees[0].id, 'active');
});

test('manager payroll includes advances in the selected period', async () => {
  const payload = await getManagerPayroll(
    createClient({ advances: [{ employeeMembershipId: 'employee-membership-1', amountCzk: '500.00' }] }),
    createManagerContext(),
    { period: 'week', anchor: '2026-08-18' }
  );

  assert.equal(payload.employees[0].summary.advancesCzk, '500.00');
  assert.equal(payload.employees[0].summary.netPayCzk, '700.00');
  assert.equal(payload.summary.advancesCzk, '500.00');
  assert.equal(payload.summary.netPayCzk, '700.00');
});

test('manager payroll resolves a complete calendar month', async () => {
  let query = null;
  const client = createClient({ onFindMany: value => (query = value) });

  const payload = await getManagerPayroll(client, createManagerContext(), {
    period: 'month',
    anchor: '2026-08-18',
  });

  assert.deepEqual(payload.period, {
    type: 'month',
    anchor: '2026-08-18',
    start: '2026-08-01',
    end: '2026-08-31',
  });
  assert.equal(query.include.workEntries.where.workDate.gte.toISOString(), '2026-08-01T00:00:00.000Z');
  assert.equal(query.include.workEntries.where.workDate.lt.toISOString(), '2026-09-01T00:00:00.000Z');
});

test('manager payroll rejects an unsupported period', async () => {
  await assert.rejects(
    getManagerPayroll(createClient(), createManagerContext(), {
      period: 'year',
      anchor: '2026-08-18',
    }),
    /Invalid payroll period/
  );
});
