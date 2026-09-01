import assert from 'node:assert/strict';
import test from 'node:test';

import { listProjects, updateProject } from '../services/projects.js';

function employeeContext() {
  return {
    activeMembership: {
      id: 'employee-1',
      userId: 'user-1',
      companyId: 'company-1',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
    },
  };
}

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

test('employee project list is tenant-scoped and active-only', async () => {
  const client = {
    project: {
      findMany: async query => {
        assert.deepEqual(query.where, {
          companyId: 'company-1',
          isActive: true,
        });
        return [];
      },
    },
  };

  const result = await listProjects(client, employeeContext());
  assert.deepEqual(result.projects, []);
});

test('manager can reactivate an inactive project in the active company', async () => {
  let updateData = null;
  const existing = {
    id: 'project-1',
    companyId: 'company-1',
    name: 'Site A',
    address: null,
    description: null,
    isActive: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const client = {
    project: {
      findFirst: async query => {
        assert.equal(query.where.id, 'project-1');
        assert.equal(query.where.companyId, 'company-1');
        return existing;
      },
      update: async args => {
        updateData = args.data;
        return { ...existing, ...args.data };
      },
    },
    auditLog: {
      create: async () => ({}),
    },
  };

  const project = await updateProject(client, managerContext(), 'project-1', { isActive: true });

  assert.equal(updateData.isActive, true);
  assert.equal(project.isActive, true);
});

test('manager cannot update a project from another company', async () => {
  const client = {
    project: {
      findFirst: async query => {
        assert.equal(query.where.companyId, 'company-1');
        return null;
      },
    },
  };

  await assert.rejects(
    () => updateProject(client, managerContext(), 'project-other', { name: 'Other' }),
    /Project not found/,
  );
});
