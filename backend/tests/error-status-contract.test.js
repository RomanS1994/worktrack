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
  ['Work entry is not pending review', 409],
  ['Invalid work time', 400],
  ['Invalid work time range', 400],
  ['Start and end time are required', 400],
  ['Work time must be longer than the automatic break', 400],
  ['Weekly submission is not pending review', 409],
  ['No work entries to submit', 400],
  ['Invalid invoice month', 400],
  ['Complete tax information before creating an invoice', 400],
  ['Employer billing information is incomplete', 400],
  ['Hourly rate must be greater than zero before creating an invoice', 400],
  ['Invoice context not found', 404],
  ['Invoice not found', 404],
  ['No uninvoiced approved hours for this month', 400],
  ['Only draft invoices can be sent', 409],
  ['Invoice cannot be cancelled', 409],
  ['Invoice cannot be marked paid', 409],
  ['Invalid payment date', 400],
  ['Payment date cannot be in the future', 400],
]);

for (const [message, expectedStatus] of EXPECTED_CLIENT_ERRORS) {
  test(`${message} maps to HTTP ${expectedStatus}`, () => {
    assert.equal(resolveErrorStatus(new Error(message)), expectedStatus);
  });
}

test('unknown backend failures remain HTTP 500', () => {
  assert.equal(resolveErrorStatus(new Error('Unexpected database failure')), 500);
});
