import assert from 'node:assert/strict';
import test from 'node:test';

import { bindRequestContext, setCorsHeaders } from '../lib/http.js';

function createResponse() {
  const headers = new Map();
  return {
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), String(value));
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
  };
}

test('CORS allows PUT for manager timesheet saves', () => {
  const response = createResponse();
  const request = { headers: { origin: 'https://example.com' } };

  bindRequestContext(response, request);
  setCorsHeaders(response);

  const methods = response.getHeader('Access-Control-Allow-Methods') || '';
  assert.match(methods, /(^|,\s*)PUT(,|$)/);
});
