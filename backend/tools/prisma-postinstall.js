import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(scriptDir, '..', 'prisma', 'schema.prisma');

const hasDatabaseUrl = Boolean(
  process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL,
);

if (!hasDatabaseUrl) {
  console.log('Skipping prisma generate: DATABASE_URL is not configured.');
  process.exit(0);
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(command, ['prisma', 'generate', '--schema', schemaPath], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
