import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnvFile } from '../config/load-env.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(scriptDir, '..', 'prisma', 'schema.prisma');
const envPath = path.join(scriptDir, '..', '.env');
const packageJsonPath = path.join(scriptDir, '..', 'package.json');

loadEnvFile(envPath);

const hasDatabaseUrl = Boolean(
  process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL,
);

if (!hasDatabaseUrl) {
  console.log('Skipping prisma generate: DATABASE_URL is not configured.');
  process.exit(0);
}

function getPrismaPackageSpec() {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const prismaVersion =
    packageJson.dependencies?.prisma || packageJson.devDependencies?.prisma;

  if (!prismaVersion) {
    throw new Error('Missing prisma dependency in backend/package.json.');
  }

  return `prisma@${prismaVersion}`;
}

const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const prismaPackageSpec = getPrismaPackageSpec();

console.log(`Generating Prisma Client with ${prismaPackageSpec}.`);

const result = spawnSync(command, [
  'exec',
  '--yes',
  `--package=${prismaPackageSpec}`,
  '--',
  'prisma',
  'generate',
  '--schema',
  schemaPath,
], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
