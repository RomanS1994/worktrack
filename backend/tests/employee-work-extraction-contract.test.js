import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const routePath = fileURLToPath(new URL('../routes/employee-work.js', import.meta.url));
const indexPath = fileURLToPath(new URL('../routes/index.js', import.meta.url));

test('employee work routes use the extracted domain service instead of the worktrack monolith', async () => {
  const source = await readFile(routePath, 'utf8');

  assert.match(source, /from '\.\.\/services\/employee-work\.js'/);
  assert.doesNotMatch(source, /from '\.\.\/services\/worktrack\.js'/);
});

test('employee work routes run before the legacy worktrack handler', async () => {
  const source = await readFile(indexPath, 'utf8');
  const employeeIndex = source.indexOf('handleEmployeeWorkRoutes,');
  const legacyIndex = source.indexOf('handleWorkTrackRoutes,');

  assert.notEqual(employeeIndex, -1, 'Employee work handler must be registered');
  assert.notEqual(legacyIndex, -1, 'Legacy worktrack handler must remain registered during extraction');
  assert.ok(employeeIndex < legacyIndex, 'Extracted employee routes must take precedence over legacy routes');
});
