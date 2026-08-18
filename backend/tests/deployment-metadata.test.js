import assert from 'node:assert/strict';
import test from 'node:test';

import { getDeploymentMetadata } from '../routes/public.js';

test('deployment metadata uses Render default environment variables when present', () => {
  const previous = {
    RENDER: process.env.RENDER,
    RENDER_GIT_BRANCH: process.env.RENDER_GIT_BRANCH,
    RENDER_GIT_COMMIT: process.env.RENDER_GIT_COMMIT,
    RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,
  };

  process.env.RENDER = 'true';
  process.env.RENDER_GIT_BRANCH = 'main';
  process.env.RENDER_GIT_COMMIT = 'abc123';
  process.env.RENDER_EXTERNAL_URL = 'https://worktrack-backend.onrender.com';

  try {
    assert.deepEqual(getDeploymentMetadata(), {
      provider: 'render',
      branch: 'main',
      commit: 'abc123',
      externalUrl: 'https://worktrack-backend.onrender.com',
    });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
