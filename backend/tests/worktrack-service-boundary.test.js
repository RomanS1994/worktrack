import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const managerEmployeesPath = fileURLToPath(new URL('../services/manager-employees.js', import.meta.url));
const managerDashboardPath = fileURLToPath(new URL('../services/manager-dashboard.js', import.meta.url));

for (const [name, path] of [
  ['manager employees', managerEmployeesPath],
  ['manager dashboard', managerDashboardPath],
]) {
  test(`${name} does not depend on the legacy worktrack service`, async () => {
    const source = await readFile(path, 'utf8');
    assert.doesNotMatch(source, /from ['"]\.\/worktrack\.js['"]/);
    assert.match(source, /from ['"]\.\/week-utils\.js['"]/);
  });
}
