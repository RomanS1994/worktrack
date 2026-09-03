import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const managerRoutePath = fileURLToPath(new URL('../routes/manager/index.js', import.meta.url));

test('manager routes use extracted workflow service instead of worktrack monolith', async () => {
  const source = await readFile(managerRoutePath, 'utf8');

  assert.match(source, /services\/manager-workflow\.js/);
  assert.doesNotMatch(source, /services\/worktrack\.js/);
});
