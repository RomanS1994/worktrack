import test from 'node:test';
import assert from 'node:assert/strict';

import { getManagerPayroll } from '../services/manager-payroll.js';

function createManagerContext() {
  return {
    activeMembership: {
      id: 'manager-membership-1',
      userId: 'manager-1',
      companyId: 'company-1',
      role: 'MANAGER',
      status: 'ACTIVE',
      company: { id: 'company-1', name: 'Acme' },
    },
    activeCompany: { id: 'company-1', name: 'Acme' },
  };
}

function createClient({ onFindMany, memberships, advances = [], breakMinutes = 0 } = {}) {
  return {
    company: {
      async findUnique() {
        return { breakMinutes, standardDailyHours: 8 };
      },
    },
    salaryAdvance: {
      async findMany() {
        return advances;
      },
    },
    companyMembership: {
      async findMany(query) {
        onFindMany?.(query);
        return memberships || [
          {
            id: 'membership-1',
            userId: 'employee-1',
            companyId: 'company-1',
            role: 'EMPLOYEE',
            status: 'ACTIVE',
            deletedAt: null,
            hourlyRateCzk: '200.00',
            user: {
              id: 'employee-1',
              firstName: 'Anna',
              lastName: 'Novak',
              email: 'anna@example.com',
              deletedAt: null,
            },
            workEntries: [
              { id: 'a1', employeeMembershipId: 'membership-1', workDate: new Date('2026-08-17T00:00:00.000Z'), status: 'APPROVED', hours: '8.00' },
              { id: 'a2', employeeMembershipId: 'membership-1', workDate: new Date('2026-08-18T00:00:00.000Z'), status: 'SUBMITTED', hours: '4.00' },
            ],
          },
          {
            id: 'membership-2',
            userId: 'employee-2',
            companyId: 'company-1',
            role: 'EMPLOYEE',
            status: 'INACTIVE',
            deletedAt: null,
            hourlyRateCzk: '300.00',
            user: {
              id: 'employee-2',
              firstName: 'Boris',
              lastName: 'Worker',
              email: 'boris@example.com',
              deletedAt: null,
            },
            workEntries: [{ id: 'b1', employeeMembershipId: 'membership-2', workDate: new Date('2026-08-17T00:00:00.000Z'), status: 'APPROVED', hours: '5.00' }],
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
  assert.equal(query.where.role, undefined);
  assert.equal(query.include.workEntries.where.workDate.gte.toISOString(), '2026-08-17T00:00:00.000Z');
  assert.equal(query.include.workEntries.where.workDate.lt.toISOString(), '2026-08-24T00:00:00.000Z');
  assert.deepEqual(query.include.workEntries.where.status.in, ['SUBMITTED', 'APPROVED']);

  assert.equal(payload.employees[0].name, 'Anna Novak');
  assert.deepEqual(payload.employees[0].summary, {
    totalHours: '12.00',
    approvedHours: '8.00',
    pendingHours: '4.00',
    confirmedSalaryCzk: '1600.00',
    predictedSalaryCzk: '800.00',
    accruedSalaryCzk: '2400.00',
    advancesCzk: '0.00',
    netPayCzk: '2400.00',
  });
  assert.equal(payload.employees[1].name, 'Boris Worker');
  assert.equal(payload.summary.employeeCount, 2);
  assert.equal(payload.summary.employeesWithHours, 2);
  assert.equal(payload.summary.approvedHours, '13.00');
  assert.equal(payload.summary.pendingHours, '4.00');
  assert.equal(payload.summary.confirmedSalaryCzk, '3100.00');
  assert.equal(payload.summary.predictedSalaryCzk, '800.00');
});

test('manager payroll deducts lunch once per employee work day', async () => {
  const client = createClient({
    breakMinutes: 60,
    memberships: [
      {
        id: 'membership-1',
        userId: 'employee-1',
        companyId: 'company-1',
        role: 'EMPLOYEE',
        status: 'ACTIVE',
        deletedAt: null,
        hourlyRateCzk: '200.00',
        user: { firstName: 'Anna', lastName: 'Novak', email: 'anna@example.com', deletedAt: null },
        workEntries: [
          { id: 'a1', employeeMembershipId: 'membership-1', projectId: 'p1', workDate: new Date('2026-08-17T00:00:00.000Z'), status: 'APPROVED', hours: '5.00' },
          { id: 'a2', employeeMembershipId: 'membership-1', projectId: 'p2', workDate: new Date('2026-08-17T00:00:00.000Z'), status: 'APPROVED', hours: '4.00' },
        ],
      },
    ],
  });

  const payload = await getManagerPayroll(client, createManagerContext(), { period: 'week', anchor: '2026-08-17' });
  assert.equal(payload.employees[0].summary.totalHours, '8.00');
  assert.equal(payload.employees[0].summary.confirmedSalaryCzk, '1600.00');
});

test('manager payroll excludes draft hours that have not been submitted', async () => {
  let query = null;
  const client = createClient({
    onFindMany: value => (query = value),
    memberships: [
      {
        id: 'membership-1', userId: 'employee-1', companyId: 'company-1', role: 'EMPLOYEE', status: 'ACTIVE', deletedAt: null,
        hourlyRateCzk: '200.00', user: { firstName: 'Anna', email: 'anna@example.com', deletedAt: null }, workEntries: [],
      },
    ],
  });
  const payload = await getManagerPayroll(client, createManagerContext(), { period: 'week', anchor: '2026-08-17' });
  assert.deepEqual(query.include.workEntries.where.status.in, ['SUBMITTED', 'APPROVED']);
  assert.equal(payload.summary.pendingHours, '0.00');
});

test('manager payroll uses the rate snapshot stored on each work entry', async () => {
  const client = createClient({
    memberships: [{
      id: 'membership-1', userId: 'employee-1', companyId: 'company-1', role: 'EMPLOYEE', status: 'ACTIVE', deletedAt: null,
      hourlyRateCzk: '300.00', user: { firstName: 'Anna', email: 'anna@example.com', deletedAt: null },
      workEntries: [{ id: 'a1', employeeMembershipId: 'membership-1', workDate: new Date('2026-08-17T00:00:00.000Z'), status: 'APPROVED', hours: '8.00', hourlyRateCzk: '200.00' }],
    }],
  });
  const payload = await getManagerPayroll(client, createManagerContext(), { period: 'week', anchor: '2026-08-17' });
  assert.equal(payload.employees[0].summary.confirmedSalaryCzk, '1600.00');
});

test('manager payroll keeps approved-only earnings payable', async () => {
  const client = createClient({
    memberships: [{
      id: 'membership-1', userId: 'employee-1', companyId: 'company-1', role: 'EMPLOYEE', status: 'ACTIVE', deletedAt: null,
      hourlyRateCzk: '200.00', user: { firstName: 'Anna', email: 'anna@example.com', deletedAt: null },
      workEntries: [{ id: 'a1', employeeMembershipId: 'membership-1', workDate: new Date('2026-08-17T00:00:00.000Z'), status: 'APPROVED', hours: '8.00' }],
    }],
  });
  const payload = await getManagerPayroll(client, createManagerContext(), { period: 'week', anchor: '2026-08-17' });
  assert.equal(payload.summary.confirmedSalaryCzk, '1600.00');
  assert.equal(payload.summary.netPayCzk, '1600.00');
});

test('manager payroll excludes inactive employees with no hours in the selected period', async () => {
  const client = createClient({
    memberships: [{
      id: 'membership-1', userId: 'employee-1', companyId: 'company-1', role: 'EMPLOYEE', status: 'INACTIVE', deletedAt: null,
      hourlyRateCzk: '200.00', user: { firstName: 'Anna', email: 'anna@example.com', deletedAt: null }, workEntries: [],
    }],
  });
  const payload = await getManagerPayroll(client, createManagerContext(), { period: 'week', anchor: '2026-08-17' });
  assert.equal(payload.employees.length, 0);
});

test('manager payroll includes advances in the selected period', async () => {
  const client = createClient({
    advances: [{ employeeMembershipId: 'membership-1', amountCzk: '500.00' }],
    memberships: [{
      id: 'membership-1', userId: 'employee-1', companyId: 'company-1', role: 'EMPLOYEE', status: 'ACTIVE', deletedAt: null,
      hourlyRateCzk: '200.00', user: { firstName: 'Anna', email: 'anna@example.com', deletedAt: null },
      workEntries: [{ id: 'a1', employeeMembershipId: 'membership-1', workDate: new Date('2026-08-17T00:00:00.000Z'), status: 'APPROVED', hours: '8.00' }],
    }],
  });
  const payload = await getManagerPayroll(client, createManagerContext(), { period: 'week', anchor: '2026-08-17' });
  assert.equal(payload.employees[0].summary.advancesCzk, '500.00');
  assert.equal(payload.employees[0].summary.netPayCzk, '1100.00');
  assert.equal(payload.summary.advancesCzk, '500.00');
});

test('manager payroll resolves a complete calendar month', async () => {
  const client = createClient({ memberships: [] });
  const payload = await getManagerPayroll(client, createManagerContext(), { period: 'month', anchor: '2026-08-18' });
  assert.deepEqual(payload.period, { type: 'month', anchor: '2026-08-18', start: '2026-08-01', end: '2026-08-31' });
});

test('manager payroll rejects an unsupported period', async () => {
  const client = createClient();
  await assert.rejects(() => getManagerPayroll(client, createManagerContext(), { period: 'quarter' }), /Invalid payroll period/);
});
