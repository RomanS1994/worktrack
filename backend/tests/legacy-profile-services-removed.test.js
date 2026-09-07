import assert from 'node:assert/strict';
import test from 'node:test';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const accountIdentityPath = fileURLToPath(new URL('../services/account-identity.js', import.meta.url));
const profilesPath = fileURLToPath(new URL('../services/profiles.js', import.meta.url));
const meRoutePath = fileURLToPath(new URL('../routes/me.js', import.meta.url));

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test('legacy account identity/profile services stay removed from the runtime surface', async () => {
  assert.equal(await exists(accountIdentityPath), false);
  assert.equal(await exists(profilesPath), false);

  const meRoute = await readFile(meRoutePath, 'utf8');
  assert.doesNotMatch(meRoute, /account-identity\.js|profiles\.js/);
});
