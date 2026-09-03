import assert from 'node:assert/strict';
import test from 'node:test';

import { handleAuthRoutes } from '../routes/auth/index.js';
import {
  clearCookie,
  getBearerToken,
  getClientIp,
  getCookie,
  parseCookies,
  setCookie,
} from '../lib/http.js';
import { getAccessTokenClaims } from '../auth/guards.js';

test('http exports auth helpers required by the complete auth route graph', () => {
  assert.equal(typeof handleAuthRoutes, 'function');
  assert.equal(typeof getAccessTokenClaims, 'function');
  assert.equal(typeof parseCookies, 'function');
  assert.equal(typeof getCookie, 'function');
  assert.equal(typeof setCookie, 'function');
  assert.equal(typeof clearCookie, 'function');
  assert.equal(typeof getClientIp, 'function');
});

test('bearer and cookie helpers preserve the auth transport contract', () => {
  assert.equal(
    getBearerToken({ headers: { authorization: 'Bearer test-token' } }),
    'test-token'
  );
  assert.equal(getBearerToken({ headers: {} }), null);

  const request = {
    headers: {
      cookie: 'session=abc%20123; theme=dark',
      'x-forwarded-for': '203.0.113.5, 10.0.0.1',
    },
  };
  assert.deepEqual(parseCookies(request), { session: 'abc 123', theme: 'dark' });
  assert.equal(getCookie(request, 'session'), 'abc 123');
  assert.equal(getClientIp(request), '203.0.113.5');
});
