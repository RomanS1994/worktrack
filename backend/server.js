import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { requireApiKey } from './auth/api-key.js';
import { loadEnvFile } from './config/load-env.js';
import { assertRuntimeEnv } from './config/runtime-env.js';
import { bindRequestContext, handleCors } from './lib/http.js';
import { sendHttpError } from './lib/errors.js';
import { attachRequestDiagnostics } from './lib/request-diagnostics.js';
import { routeRequest } from './routes/index.js';
import { createChatNotificationWorker } from './services/chat-notification-outbox.js';

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
const chatNotificationWorker = createChatNotificationWorker({ client: prisma });

const server = http.createServer(async (request, response) => {
  try {
    bindRequestContext(response, request);
    attachRequestDiagnostics(request, response);
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
  if (shuttingDown) return;

  server.listen(PORT, HOST, () => {
    console.log(`WorkTrack backend is running on http://${HOST}:${PORT}`);
    chatNotificationWorker.start();
  });
}

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const deadline = setTimeout(() => {
    server.closeAllConnections();
    process.exit(1);
  }, 20_000);
  deadline.unref();
  // Stop claiming new jobs. Interrupted work remains recoverable via its lease.
  await Promise.all([
    chatNotificationWorker.stop(),
    new Promise(resolve => {
      server.close(resolve);
      // SSE connections otherwise prevent server.close from completing.
      server.closeAllConnections();
    }),
  ]);
  await prisma.$disconnect();
  clearTimeout(deadline);
}
process.once('SIGTERM', () => { void shutdown().catch(() => process.exit(1)); });
process.once('SIGINT', () => { void shutdown().catch(() => process.exit(1)); });

startServer().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
