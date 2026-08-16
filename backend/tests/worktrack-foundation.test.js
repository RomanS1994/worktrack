import assert from 'node:assert/strict';
import test from 'node:test';

import { hasManagerAccess } from '../auth/guards.js';
import { buildSanitizedUser } from '../db/prisma-helpers.js';

test('manager access is restricted to MANAGER role', () => {
  assert.equal(hasManagerAccess('MANAGER'), true);
  assert.equal(hasManagerAccess('EMPLOYEE'), false);
  assert.equal(hasManagerAccess('ADMIN'), false);
  assert.equal(hasManagerAccess('owner'), false);
  assert.equal(hasManagerAccess(null), false);
});

test('sanitized user exposes only WorkTrack account fields', async () => {
  const user = await buildSanitizedUser(null, {
    id: 'user-1',
    email: 'employee@example.com',
    firstName: 'Jane',
    lastName: 'Worker',
    name: 'Jane Worker',
    phone: null,
    role: 'EMPLOYEE',
    managerId: 'manager-1',
    hourlyRateCzk: '250.00',
    profile: { department: 'Operations' },
    deletedAt: null,
    createdAt: new Date('2026-08-16T08:00:00.000Z'),
    updatedAt: new Date('2026-08-16T09:00:00.000Z'),
  });

  assert.deepEqual(user, {
    id: 'user-1',
    email: 'employee@example.com',
    firstName: 'Jane',
    lastName: 'Worker',
    name: 'Jane Worker',
    phone: '',
    role: 'EMPLOYEE',
    managerId: 'manager-1',
    hourlyRateCzk: '250.00',
    profile: { department: 'Operations' },
    deletedAt: '',
    createdAt: '2026-08-16T08:00:00.000Z',
    updatedAt: '2026-08-16T09:00:00.000Z',
  });
});
