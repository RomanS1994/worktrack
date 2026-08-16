import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { requireApiKey } from './auth/api-key.js';
import { loadEnvFile } from './config/load-env.js';
import { assertRuntimeEnv } from './config/runtime-env.js';
import { bindRequestContext, handleCors } from './lib/http.js';
import { sendHttpError } from './lib/errors.js';
import { routeRequest } from './routes/index.js';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.join(serverDir, '.env'));

const PORT = Number(process.env.PORT || process.env.BACKEND_PORT || 3000);
const HOST = '0.0.0.0';

try {
  assertRuntimeEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const { prisma } = await import('./db/prisma.js');

const server = http.createServer(async (request, response) => {
  try {
    bindRequestContext(response, request);
    if (handleCors(request, response)) return;
    if (!requireApiKey(request, response)) return;

    await routeRequest(request, response);
  } catch (error) {
    sendHttpError(response, error);
  }
});

async function initializeDatabase() {
  try {
    await prisma.$connect();
  } catch (error) {
    throw new Error(
      `Failed to start backend against PostgreSQL via Prisma: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function startServer() {
  await initializeDatabase();

  server.listen(PORT, HOST, () => {
    console.log(`WorkTrack backend is running on http://${HOST}:${PORT}`);
  });
}

startServer().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
