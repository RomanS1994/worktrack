import assert from 'node:assert/strict';
import test from 'node:test';

import { getManagerTimesheet, upsertManagerTimesheetCell } from '../services/manager-timesheet.js';

function context() {
  return {
    activeMembership: {
      id: 'manager-1',
      companyId: 'company-1',
      role: 'MANAGER',
      status: 'ACTIVE',
    },
  };
}

function employee(overrides = {}) {
  return {
    id: 'employee-1',
    companyId: 'company-1',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    user: { name: 'Dima Worker', email: 'dima@example.com' },
    ...overrides,
  };
}

function readClient({ workEntries = [], managerEntries = [], breakMinutes = 0, employees = [employee()] } = {}) {
  return {
    companyMembership: { findMany: async () => employees },
    workEntry: { findMany: async () => workEntries },
    project: {
      findMany: async () => [
        { id: 'project-a', name: 'Praha 5' },
        { id: 'project-b', name: 'Brno' },
      ],
    },
    managerTimesheetEntry: { findMany: async () => managerEntries },
    company: { findUnique: async () => ({ breakMinutes }) },
  };
}

function workEntry(overrides = {}) {
  return {
    id: 'work-1',
    employeeMembershipId: 'employee-1',
    workDate: new Date('2026-08-10T00:00:00.000Z'),
    hours: '8.00',
    grossHours: null,
    breakMinutes: 0,
    projectId: 'project-a',
    project: { name: 'Praha 5' },
    ...overrides,
  };
}

function managerEntry(overrides = {}) {
  return {
    id: 'manager-entry-1',
    employeeMembershipId: 'employee-1',
    workDate: new Date('2026-08-10T00:00:00.000Z'),
    hours: '8.00',
    breakMinutes: 0,
    projectId: 'project-a',
    note: null,
    ...overrides,
  };
}

test('manager timesheet compares against net hours after lunch deduction', async () => {
  const payload = await getManagerTimesheet(
    readClient({
      workEntries: [workEntry({ hours: '8.50', grossHours: '8.50', breakMinutes: 30 })],
      managerEntries: [managerEntry({ hours: '8.00', breakMinutes: 30 })],
    }),
    context(),
    { month: '2026-08' }
  );

  const day = payload.rows[0].days[9];
  assert.equal(day.employeeHours, 8);
  assert.equal(day.managerHours, 8);
  assert.equal(day.status, 'MATCH');
  assert.deepEqual(day.reasons, []);
  assert.equal(payload.summary.matched, 1);
  assert.equal(payload.summary.problems, 0);
});

test('manager timesheet pinpoints a half-hour mismatch', async () => {
  const payload = await getManagerTimesheet(
    readClient({
      workEntries: [workEntry()],
      managerEntries: [managerEntry({ hours: '7.50' })],
    }),
    context(),
    { month: '2026-08' }
  );

  const day = payload.rows[0].days[9];
  assert.equal(day.status, 'MISMATCH');
  assert.deepEqual(day.reasons, ['hours']);
  assert.equal(day.difference, -0.5);
  assert.equal(payload.rows[0].problems, 1);
});

test('manager timesheet reports lunch and project differences separately', async () => {
  const payload = await getManagerTimesheet(
    readClient({
      workEntries: [workEntry({ hours: '8.50', grossHours: '8.50', breakMinutes: 30 })],
      managerEntries: [managerEntry({ hours: '8.00', breakMinutes: 60, projectId: 'project-b' })],
    }),
    context(),
    { month: '2026-08' }
  );

  const day = payload.rows[0].days[9];
  assert.equal(day.employeeHours, 8);
  assert.equal(day.managerHours, 8);
  assert.equal(day.status, 'MISMATCH');
  assert.deepEqual(day.reasons, ['break', 'project']);
  assert.deepEqual(day.employeeProjects, ['Praha 5']);
});

test('manager timesheet distinguishes which side is missing', async () => {
  const missingManager = await getManagerTimesheet(
    readClient({ workEntries: [workEntry()] }),
    context(),
    { month: '2026-08' }
  );
  assert.equal(missingManager.rows[0].days[9].status, 'MISSING_MANAGER');

  const missingEmployee = await getManagerTimesheet(
    readClient({ managerEntries: [managerEntry()] }),
    context(),
    { month: '2026-08' }
  );
  assert.equal(missingEmployee.rows[0].days[9].status, 'MISSING_EMPLOYEE');
});

test('historical timesheet keeps an inactive employee when the selected month has data', async () => {
  const payload = await getManagerTimesheet(
    readClient({
      employees: [employee({ status: 'INACTIVE' })],
      workEntries: [workEntry()],
    }),
    context(),
    { month: '2026-08' }
  );

  assert.equal(payload.rows.length, 1);
  assert.equal(payload.rows[0].employeeId, 'employee-1');
  assert.equal(payload.rows[0].status, 'INACTIVE');
  assert.equal(payload.rows[0].employeeTotal, 8);
});

test('historical timesheet hides an inactive employee with no data in the selected month', async () => {
  const payload = await getManagerTimesheet(
    readClient({ employees: [employee({ status: 'INACTIVE' })] }),
    context(),
    { month: '2026-08' }
  );

  assert.equal(payload.rows.length, 0);
  assert.equal(payload.summary.employees, 0);
});

test('manager timesheet rejects non-numeric hour input instead of deleting a cell', async () => {
  const client = {
    companyMembership: { findFirst: async () => ({ id: 'employee-1' }) },
  };

  await assert.rejects(
    upsertManagerTimesheetCell(client, context(), 'employee-1', {
      date: '2026-08-10',
      hours: 'wrong',
      breakMinutes: '',
      projectId: '',
    }),
    /Invalid hours/
  );
});

test('manager timesheet clears an existing manager control entry', async () => {
  let deletedId = null;
  const client = {
    companyMembership: { findFirst: async () => ({ id: 'employee-1' }) },
    managerTimesheetEntry: {
      findUnique: async () => ({ id: 'manager-entry-1', companyId: 'company-1' }),
      delete: async ({ where }) => { deletedId = where.id; },
    },
  };

  const result = await upsertManagerTimesheetCell(client, context(), 'employee-1', {
    date: '2026-08-10',
    hours: '',
    breakMinutes: '',
    projectId: '',
  });

  assert.deepEqual(result, { deleted: true });
  assert.equal(deletedId, 'manager-entry-1');
});
