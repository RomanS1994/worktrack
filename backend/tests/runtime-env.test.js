import assert from 'node:assert/strict';
import test from 'node:test';

import { assertRuntimeEnv, validateRuntimeEnv } from '../config/runtime-env/validate.js';

const ENV_KEYS = [
  'NODE_ENV',
  'AUTH_TOKEN_SECRET',
  'API_KEY',
  'DATABASE_URL',
  'DIRECT_DATABASE_URL',
  'CLIENT_ORIGIN',
];

function withEnvironment(values, callback) {
  const previous = Object.fromEntries(
    ENV_KEYS.map(key => [key, process.env[key]]),
  );

  try {
    ENV_KEYS.forEach(key => {
      delete process.env[key];
    });

    Object.entries(values).forEach(([key, value]) => {
      process.env[key] = value;
    });

    callback();
  } finally {
    ENV_KEYS.forEach(key => {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
}

test('production environment requires only backend deployment variables', () => {
  withEnvironment(
    {
      NODE_ENV: 'production',
      AUTH_TOKEN_SECRET: 'a-secure-auth-token-secret-that-is-long-enough',
      DATABASE_URL: 'postgresql://db.internal:5432/worktrack',
      CLIENT_ORIGIN: 'https://worktrackings.netlify.app',
    },
    () => {
      const validation = validateRuntimeEnv();
      assert.equal(validation.ok, true);
      assert.deepEqual(validation.errors, []);
    },
  );
});

test('backend environment error does not present Vite variables as Render requirements', () => {
  withEnvironment({ NODE_ENV: 'production' }, () => {
    assert.throws(
      () => assertRuntimeEnv(),
      error => {
        assert.match(error.message, /AUTH_TOKEN_SECRET is required/);
        assert.match(error.message, /DATABASE_URL or DIRECT_DATABASE_URL is required/);
        assert.match(error.message, /CLIENT_ORIGIN is required in production/);
        assert.doesNotMatch(error.message, /frontend: VITE_API_BASE_URL/);
        assert.match(
          error.message,
          /Frontend VITE_\* variables belong on Netlify and are not required by the Render API service/,
        );
        return true;
      },
    );
  });
});
