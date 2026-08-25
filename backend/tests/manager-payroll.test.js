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

function createClient({ onFindMany, standardDailyHours = '8.00' } = {}) {
  return {
    company: {
      findUnique: async () => ({ standardDailyHours }),
    },
    companyMembership: {
      findMany: async query => {
        onFindMany?.(query);
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
              { id: 'a1', status: 'APPROVED', hours: '8.00', workDate: new Date('2026-08-17T00:00:00.000Z') },
              { id: 'a2', status: 'SUBMITTED', hours: '4.00', workDate: new Date('2026-08-18T00:00:00.000Z') },
              { id: 'a3', status: 'DRAFT', hours: '6.00', workDate: new Date('2026-08-18T00:00:00.000Z') },
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
            workEntries: [
              { id: 'b1', status: 'APPROVED', hours: '9.50', workDate: new Date('2026-08-19T00:00:00.000Z') },
            ],
          },
        ];
      },
    },
  };
}

test('manager payroll calculates a selected week, salary and overtime breakdown', async () => {
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

  assert.equal(payload.company.standardDailyHours, '8.00');
  assert.equal(payload.employees[0].name, 'Anna Novak');
  assert.deepEqual(payload.employees[0].summary, {
    totalHours: '18.00',
    approvedHours: '8.00',
    pendingHours: '10.00',
    confirmedSalaryCzk: '1600.00',
    predictedSalaryCzk: '2000.00',
    overtimeHours: '2.00',
    approvedOvertimeHours: '0.00',
    pendingOvertimeHours: '2.00',
  });
  assert.equal(payload.employees[1].status, 'INACTIVE');
  assert.equal(payload.employees[1].summary.overtimeHours, '1.50');
  assert.deepEqual(payload.summary, {
    employeeCount: 2,
    employeesWithHours: 2,
    approvedHours: '17.50',
    pendingHours: '10.00',
    overtimeHours: '3.50',
    approvedOvertimeHours: '1.50',
    pendingOvertimeHours: '2.00',
    confirmedSalaryCzk: '4450.00',
    predictedSalaryCzk: '2000.00',
  });
});

test('manager payroll uses the configured company daily norm', async () => {
  const payload = await getManagerPayroll(
    createClient({ standardDailyHours: '7.50' }),
    createManagerContext(),
    { period: 'week', anchor: '2026-08-18' }
  );

  assert.equal(payload.company.standardDailyHours, '7.50');
  assert.equal(payload.employees[0].summary.overtimeHours, '2.50');
  assert.equal(payload.employees[1].summary.overtimeHours, '2.00');
  assert.equal(payload.summary.overtimeHours, '4.50');
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
