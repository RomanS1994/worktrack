import assert from 'node:assert/strict';
import test from 'node:test';

import { deleteManagerEmployee, deleteProject, restoreDeletedManagerEmployee } from '../services/deletion.js';

function managerContext() {
  return {
    activeMembership: {
      id: 'manager-1',
      userId: 'manager-user-1',
      companyId: 'company-1',
      role: 'MANAGER',
      status: 'ACTIVE',
      deletedAt: null,
    },
  };
}

test('employee delete tombstones membership instead of deleting financial history', async () => {
  const calls = [];
  const employee = {
    id: 'employee-1', companyId: 'company-1', userId: 'employee-user-1', role: 'EMPLOYEE', status: 'ACTIVE', deletedAt: null,
    hourlyRateCzk: '300.00', user: { email: 'employee@example.com', name: 'Employee One' },
  };
  const client = {
    companyMembership: {
      findFirst: async () => employee,
      update: async ({ where, data }) => { calls.push(['membership.update', where, data]); return { ...employee, ...data }; },
      delete: async () => { throw new Error('physical membership delete must not be called'); },
    },
    invoice: { deleteMany: async () => { throw new Error('invoice history must not be deleted'); } },
    invoiceItem: { deleteMany: async () => { throw new Error('invoice item history must not be deleted'); } },
    user: { delete: async () => { throw new Error('user must not be hard-deleted by company employee delete'); } },
    auditLog: { create: async payload => { calls.push(['audit.create', payload]); return payload; } },
  };

  const result = await deleteManagerEmployee(client, managerContext(), employee.id);
  assert.deepEqual(result, { ok: true, employeeId: 'employee-1', archived: true });
  assert.equal(calls[0][0], 'membership.update');
  assert.equal(calls[0][1].id, 'employee-1');
  assert.equal(calls[0][2].status, 'INACTIVE');
  assert.ok(calls[0][2].deletedAt instanceof Date);
});

test('employee delete marks a previously deactivated membership as deleted', async () => {
  let updateData = null;
  const employee = {
    id: 'employee-1', companyId: 'company-1', userId: 'employee-user-1', role: 'EMPLOYEE', status: 'INACTIVE', deletedAt: null,
    hourlyRateCzk: '300.00', user: { email: 'employee@example.com', name: 'Employee One' },
  };
  const client = {
    companyMembership: {
      findFirst: async () => employee,
      update: async ({ data }) => { updateData = data; return { ...employee, ...data }; },
    },
    auditLog: { create: async payload => payload },
  };

  await deleteManagerEmployee(client, managerContext(), 'employee-1');
  assert.equal(updateData.status, 'INACTIVE');
  assert.ok(updateData.deletedAt instanceof Date);
});

test('employee delete is idempotent once deletedAt is present', async () => {
  let updates = 0;
  const deletedAt = new Date('2026-08-29T10:00:00.000Z');
  const client = {
    companyMembership: {
      findFirst: async () => ({
        id: 'employee-1', companyId: 'company-1', userId: 'employee-user-1', role: 'EMPLOYEE', status: 'INACTIVE', deletedAt,
        hourlyRateCzk: '300.00', user: { email: 'employee@example.com', name: 'Employee One' },
      }),
      update: async () => { updates += 1; },
    },
    auditLog: { create: async payload => payload },
  };

  const result = await deleteManagerEmployee(client, managerContext(), 'employee-1');
  assert.equal(result.archived, true);
  assert.equal(updates, 0);
});

test('rehiring the same email restores the old membership id and history anchor', async () => {
  const deletedAt = new Date('2026-08-20T10:00:00.000Z');
  let membershipUpdate = null;
  const user = {
    id: 'employee-user-1', email: 'employee@example.com', firstName: 'Old', lastName: 'Name', name: 'Old Name', phone: '', deletedAt: null,
  };
  const membership = {
    id: 'employee-1', companyId: 'company-1', userId: user.id, role: 'EMPLOYEE', status: 'INACTIVE', deletedAt, hourlyRateCzk: '250.00',
  };
  const client = {
    user: {
      findUnique: async () => user,
      update: async ({ data }) => ({ ...user, ...data }),
    },
    companyMembership: {
      findUnique: async () => membership,
      update: async ({ data }) => { membershipUpdate = data; return { ...membership, ...data }; },
    },
    auditLog: { create: async payload => payload },
  };

  const restored = await restoreDeletedManagerEmployee(client, managerContext(), {
    firstName: 'New', lastName: 'Worker', email: 'EMPLOYEE@example.com', hourlyRateCzk: '320',
  });

  assert.equal(restored.id, 'employee-1');
  assert.equal(restored.status, 'ACTIVE');
  assert.equal(restored.hourlyRateCzk, '320.00');
  assert.deepEqual(membershipUpdate, { status: 'ACTIVE', deletedAt: null, hourlyRateCzk: '320.00' });
});

test('rehire helper ignores a merely deactivated employee', async () => {
  const client = {
    user: { findUnique: async () => ({ id: 'employee-user-1', email: 'employee@example.com', deletedAt: null }) },
    companyMembership: {
      findUnique: async () => ({ id: 'employee-1', companyId: 'company-1', userId: 'employee-user-1', status: 'INACTIVE', deletedAt: null }),
    },
  };
  const result = await restoreDeletedManagerEmployee(client, managerContext(), { email: 'employee@example.com', hourlyRateCzk: '300' });
  assert.equal(result, null);
});

test('project delete is blocked when work history exists', async () => {
  const client = {
    project: {
      findFirst: async () => ({ id: 'project-1', companyId: 'company-1', name: 'Old Site', isActive: true }),
      delete: async () => { throw new Error('project with history must not be physically deleted'); },
    },
    workEntry: { count: async () => 1 },
    managerTimesheetEntry: { count: async () => 0 },
  };

  await assert.rejects(deleteProject(client, managerContext(), 'project-1'), /work history and cannot be deleted/);
});
