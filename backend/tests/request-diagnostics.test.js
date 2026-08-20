import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import { attachRequestDiagnostics } from '../lib/request-diagnostics.js';

class FakeResponse extends EventEmitter {
  constructor() {
    super();
    this.statusCode = 200;
    this.headers = new Map();
  }

  setHeader(name, value) {
    this.headers.set(name.toLowerCase(), value);
  }

  getHeader(name) {
    return this.headers.get(name.toLowerCase());
  }
}

test('logs failed requests without query strings or request secrets', () => {
  const response = new FakeResponse();
  const messages = [];
  const logger = {
    warn(message) { messages.push(message); },
    error(message) { messages.push(message); },
  };
  const request = {
    method: 'GET',
    url: '/api/manager/employees?token=secret&company=private',
  };

  attachRequestDiagnostics(request, response, logger);
  response.statusCode = 403;
  response.emit('finish');

  assert.equal(typeof response.getHeader('x-request-id'), 'string');
  assert.equal(messages.length, 1);
  assert.match(messages[0], /GET \/api\/manager\/employees -> 403$/);
  assert.doesNotMatch(messages[0], /secret|private|token=/);
});

test('does not log successful responses', () => {
  const response = new FakeResponse();
  const messages = [];
  const logger = {
    warn(message) { messages.push(message); },
    error(message) { messages.push(message); },
  };

  attachRequestDiagnostics({ method: 'GET', url: '/api/health' }, response, logger);
  response.statusCode = 200;
  response.emit('finish');

  assert.deepEqual(messages, []);
});
