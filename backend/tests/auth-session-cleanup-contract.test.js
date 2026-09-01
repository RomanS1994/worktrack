import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const guardsPath = fileURLToPath(new URL('../auth/guards.js', import.meta.url));

test('auth context does not globally delete expired sessions on every request', async () => {
  const source = await readFile(guardsPath, 'utf8');

  assert.equal(
    source.includes("session.deleteMany({\n        where: {\n          expiresAt:"),
    false,
    'Expired-session maintenance must not run as a global delete inside every authenticated request',
  );

  assert.match(
    source,
    /session\.expiresAt[\s\S]{0,120}getTime\(\)\s*<=\s*Date\.now\(\)/,
    'The current session must still be rejected when it is expired',
  );
});
