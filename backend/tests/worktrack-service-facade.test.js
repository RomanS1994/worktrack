import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const servicePath = fileURLToPath(new URL('../services/worktrack.js', import.meta.url));

test('worktrack service remains a thin compatibility facade', async () => {
  const source = await readFile(servicePath, 'utf8');
  const lines = source.split('\n').length;

  assert.ok(lines < 100, `worktrack compatibility facade grew to ${lines} lines`);
  assert.doesNotMatch(source, /client\.(user|company|companyMembership|project|workEntry|weeklySubmission|auditLog)\./);
  assert.doesNotMatch(source, /randomUUID\(/);
  assert.match(source, /from '\.\/employee-work\.js'/);
  assert.match(source, /from '\.\/manager-workflow\.js'/);
  assert.match(source, /from '\.\/projects\.js'/);
  assert.match(source, /from '\.\/company-settings\.js'/);
});
