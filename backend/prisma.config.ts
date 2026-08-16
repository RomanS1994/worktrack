import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'prisma/config';
import { loadEnvFile } from './config/load-env.js';

const configDir = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.join(configDir, '.env'));

const prismaDatasourceUrl =
  process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!prismaDatasourceUrl) {
  throw new Error(
    'Missing DATABASE_URL or DIRECT_DATABASE_URL. Check backend/.env'
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  engine: 'classic',
  datasource: {
    url: prismaDatasourceUrl,
  },
});
