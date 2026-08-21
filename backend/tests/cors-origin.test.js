import assert from 'node:assert/strict';
import test from 'node:test';

import { bindRequestContext, setCorsHeaders } from '../lib/http.js';

function createResponse() {
  const headers = new Map();

  return {
    headers,
    getHeader(name) {
      return headers.get(name);
    },
    setHeader(name, value) {
      headers.set(name, value);
    },
  };
}

test('CORS normalizes configured production origin with a trailing slash', () => {
  const previousOrigin = process.env.CLIENT_ORIGIN;
  process.env.CLIENT_ORIGIN = 'https://worktrackings.netlify.app/';

  try {
    const response = createResponse();
    bindRequestContext(response, {
      headers: {
        origin: 'https://worktrackings.netlify.app',
      },
    });

    setCorsHeaders(response);

    assert.equal(
      response.getHeader('Access-Control-Allow-Origin'),
      'https://worktrackings.netlify.app'
    );
    assert.equal(response.getHeader('Access-Control-Allow-Credentials'), 'true');
  } finally {
    if (previousOrigin === undefined) delete process.env.CLIENT_ORIGIN;
    else process.env.CLIENT_ORIGIN = previousOrigin;
  }
});

test('CORS normalizes every configured origin before matching', () => {
  const previousOrigin = process.env.CLIENT_ORIGIN;
  process.env.CLIENT_ORIGIN = 'https://preview.example.com/, https://worktrackings.netlify.app/';

  try {
    const response = createResponse();
    bindRequestContext(response, {
      headers: {
        origin: 'https://worktrackings.netlify.app',
      },
    });

    setCorsHeaders(response);

    assert.equal(
      response.getHeader('Access-Control-Allow-Origin'),
      'https://worktrackings.netlify.app'
    );
  } finally {
    if (previousOrigin === undefined) delete process.env.CLIENT_ORIGIN;
    else process.env.CLIENT_ORIGIN = previousOrigin;
  }
});
