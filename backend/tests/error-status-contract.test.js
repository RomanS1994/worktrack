import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveErrorStatus } from '../lib/errors.js';

const EXPECTED_CLIENT_ERRORS = new Map([
  ['Company access is required', 403],
  ['Manager access is required', 403],
  ['Employee access is required', 403],
  ['Business identifiers are already used', 409],
  ['Notification not found', 404],
  ['Invalid payroll anchor date', 400],
  ['Invalid payroll period', 400],
  ['Rejection reason is required', 400],
  ['Rejection reason must be 500 characters or fewer', 400],
  ['Work entry already exists', 409],
  ['Work entry is locked', 409],
  ['Weekly submission is not pending review', 409],
  ['No work entries to submit', 400],
]);

for (const [message, expectedStatus] of EXPECTED_CLIENT_ERRORS) {
  test(`${message} maps to HTTP ${expectedStatus}`, () => {
    assert.equal(resolveErrorStatus(new Error(message)), expectedStatus);
  });
}

test('unknown backend failures remain HTTP 500', () => {
  assert.equal(resolveErrorStatus(new Error('Unexpected database failure')), 500);
});
