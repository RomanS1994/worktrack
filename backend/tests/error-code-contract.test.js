import assert from 'node:assert/strict';
import test from 'node:test';

import { getErrorCode, sendError } from '../lib/http.js';

function response() {
  const headers = new Map();
  return {
    statusCode: 0,
    body: '',
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
    writeHead(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    end(chunk = '') {
      this.body += String(chunk || '');
    },
  };
}

test('access errors expose stable codes while preserving the legacy message', () => {
  const res = response();
  sendError(res, 403, 'Manager access is required');

  const payload = JSON.parse(res.body);
  assert.equal(res.statusCode, 403);
  assert.equal(payload.error, 'Manager access is required');
  assert.equal(payload.errorCode, 'MANAGER_ACCESS_REQUIRED');
  assert.equal(payload.details, null);
});

test('unknown errors do not invent an error code', () => {
  const res = response();
  sendError(res, 400, 'Something custom happened');

  const payload = JSON.parse(res.body);
  assert.equal(payload.error, 'Something custom happened');
  assert.equal(Object.hasOwn(payload, 'errorCode'), false);
});

test('session and company access messages map to stable identifiers', () => {
  assert.equal(getErrorCode('Company access is required'), 'COMPANY_ACCESS_REQUIRED');
  assert.equal(getErrorCode('Employee access is required'), 'EMPLOYEE_ACCESS_REQUIRED');
  assert.equal(getErrorCode('Invalid or expired session'), 'SESSION_INVALID');
});
