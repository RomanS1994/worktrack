import assert from 'node:assert/strict';
import test from 'node:test';

import { getBearerToken } from '../lib/http.js';
import { getAccessTokenClaims } from '../auth/guards.js';

test('http exports bearer token parser required by auth guards', () => {
  assert.equal(
    getBearerToken({ headers: { authorization: 'Bearer test-token' } }),
    'test-token'
  );
  assert.equal(getBearerToken({ headers: {} }), '');
  assert.equal(typeof getAccessTokenClaims, 'function');
});
