import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyPassword } from '../auth/tokens.js';
import { resetEmployeePassword } from '../services/employee-password-reset.js';

function createManagerContext() {
  return {
    activeMembership: {
      id: 'manager-membership-1',
      userId: 'manager-user-1',
      companyId: 'company-1',
      role: 'MANAGER',
      status: 'ACTIVE',
    },
  };
}

test('manager password reset rejects a temporary password shorter than 8 characters', async () => {
  let membershipLookupCount = 0;
  const client = {
    companyMembership: {
      findFirst: async () => {
        membershipLookupCount += 1;
        return null;
      },
    },
  };

  await assert.rejects(
    resetEmployeePassword(client, createManagerContext(), 'employee-membership-1', {
      temporaryPassword: 'short',
    }),
    /Password must be at least 8 characters long/
  );

  assert.equal(membershipLookupCount, 0);
});

test('manager can reset an employee password and revoke existing sessions', async () => {
  const temporaryPassword = 'Temporary-123';
  let membershipQuery = null;
  let userUpdate = null;
  let sessionDelete = null;
  let auditCreate = null;

  const client = {
    companyMembership: {
      findFirst: async query => {
        membershipQuery = query;
        return {
          id: 'employee-membership-1',
          userId: 'employee-user-1',
          companyId: 'company-1',
          role: 'EMPLOYEE',
          status: 'ACTIVE',
          user: {
            id: 'employee-user-1',
            email: 'employee@example.com',
            deletedAt: null,
          },
        };
      },
    },
    user: {
      update: async payload => {
        userUpdate = payload;
        return { id: payload.where.id };
      },
    },
    session: {
      deleteMany: async payload => {
        sessionDelete = payload;
        return { count: 2 };
      },
    },
    auditLog: {
      create: async payload => {
        auditCreate = payload;
        return payload.data;
      },
    },
  };

  const result = await resetEmployeePassword(
    client,
    createManagerContext(),
    'employee-membership-1',
    { temporaryPassword }
  );

  assert.deepEqual(result, {
    ok: true,
    employeeId: 'employee-membership-1',
  });
  assert.equal(membershipQuery.where.id, 'employee-membership-1');
  assert.equal(membershipQuery.where.companyId, 'company-1');
  assert.equal(membershipQuery.where.role, 'EMPLOYEE');
  assert.equal(userUpdate.where.id, 'employee-user-1');
  assert.equal(userUpdate.data.mustChangePassword, true);
  assert.equal(verifyPassword(temporaryPassword, userUpdate.data.passwordHash), true);
  assert.deepEqual(sessionDelete.where, { userId: 'employee-user-1' });
  assert.equal(auditCreate.data.action, 'employee.password.reset');
  assert.equal(auditCreate.data.actorUserId, 'manager-user-1');
  assert.equal(auditCreate.data.targetUserId, 'employee-user-1');
  assert.equal(auditCreate.data.after.mustChangePassword, true);
  assert.equal(auditCreate.data.after.sessionsRevoked, true);
  assert.equal(JSON.stringify(auditCreate).includes(temporaryPassword), false);
});

test('manager cannot reset a password for an employee outside the active company', async () => {
  const client = {
    companyMembership: {
      findFirst: async query => {
        assert.equal(query.where.companyId, 'company-1');
        return null;
      },
    },
  };

  await assert.rejects(
    resetEmployeePassword(client, createManagerContext(), 'other-company-membership', {
      temporaryPassword: 'Temporary-123',
    }),
    /Employee not found/
  );
});
