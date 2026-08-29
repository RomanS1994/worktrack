import assert from 'node:assert/strict';
import test from 'node:test';

import { deleteManagerEmployee, deleteProject } from '../services/deletion.js';

function managerContext() {
  return {
    activeMembership: {
      id: 'manager-1',
      userId: 'manager-user-1',
      companyId: 'company-1',
      role: 'MANAGER',
      status: 'ACTIVE',
    },
  };
}

test('employee delete archives membership instead of deleting financial history', async () => {
  const calls = [];
  const employee = {
    id: 'employee-1',
    companyId: 'company-1',
    userId: 'employee-user-1',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    hourlyRateCzk: '300.00',
    user: { email: 'employee@example.com', name: 'Employee One' },
  };

  const client = {
    companyMembership: {
      findFirst: async () => employee,
      update: async ({ where, data }) => {
        calls.push(['membership.update', where, data]);
        return { ...employee, ...data };
      },
      delete: async () => {
        throw new Error('physical membership delete must not be called');
      },
    },
    invoice: {
      deleteMany: async () => {
        throw new Error('invoice history must not be deleted');
      },
    },
    invoiceItem: {
      deleteMany: async () => {
        throw new Error('invoice item history must not be deleted');
      },
    },
    user: {
      delete: async () => {
        throw new Error('user must not be hard-deleted by company employee delete');
      },
    },
    auditLog: {
      create: async payload => {
        calls.push(['audit.create', payload]);
        return payload;
      },
    },
  };

  const result = await deleteManagerEmployee(client, managerContext(), employee.id);

  assert.deepEqual(result, { ok: true, employeeId: 'employee-1', archived: true });
  assert.equal(calls[0][0], 'membership.update');
  assert.equal(calls[0][1].id, 'employee-1');
  assert.deepEqual(calls[0][2], { status: 'INACTIVE' });
});

test('employee delete is idempotent for an already inactive membership', async () => {
  let updates = 0;
  const client = {
    companyMembership: {
      findFirst: async () => ({
        id: 'employee-1',
        companyId: 'company-1',
        userId: 'employee-user-1',
        role: 'EMPLOYEE',
        status: 'INACTIVE',
        hourlyRateCzk: '300.00',
        user: { email: 'employee@example.com', name: 'Employee One' },
      }),
      update: async () => {
        updates += 1;
      },
    },
    auditLog: { create: async payload => payload },
  };

  const result = await deleteManagerEmployee(client, managerContext(), 'employee-1');
  assert.equal(result.archived, true);
  assert.equal(updates, 0);
});

test('project delete is blocked when work history exists', async () => {
  const client = {
    project: {
      findFirst: async () => ({ id: 'project-1', companyId: 'company-1', name: 'Old Site', isActive: true }),
      delete: async () => {
        throw new Error('project with history must not be physically deleted');
      },
    },
    workEntry: { count: async () => 1 },
    managerTimesheetEntry: { count: async () => 0 },
  };

  await assert.rejects(
    deleteProject(client, managerContext(), 'project-1'),
    /work history and cannot be deleted/
  );
});
