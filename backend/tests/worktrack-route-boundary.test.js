import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const routePath = fileURLToPath(new URL('../routes/worktrack.js', import.meta.url));

test('legacy worktrack route is limited to the shared work summary endpoint', async () => {
  const source = await readFile(routePath, 'utf8');

  assert.match(source, /pathName !== '\/api\/work-summary'/);
  assert.doesNotMatch(source, /\/api\/work-entries/);
  assert.doesNotMatch(source, /\/api\/weekly-submissions/);
  assert.doesNotMatch(source, /\/api\/projects/);
  assert.doesNotMatch(source, /\/api\/company-settings/);
});
