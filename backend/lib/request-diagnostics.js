import { randomUUID } from 'node:crypto';

function safePathname(value) {
  try {
    return new URL(value || '/', 'http://localhost').pathname;
  } catch {
    return '/';
  }
}

export function attachRequestDiagnostics(request, response, logger = console) {
  const requestId = randomUUID();
  const method = String(request?.method || 'UNKNOWN').toUpperCase();
  const pathname = safePathname(request?.url);

  response.setHeader('X-Request-ID', requestId);

  response.once('finish', () => {
    const statusCode = Number(response.statusCode || 0);
    if (statusCode < 400) return;

    const log = statusCode >= 500 ? logger.error : logger.warn;
    log.call(logger, `[http] ${requestId} ${method} ${pathname} -> ${statusCode}`);
  });

  return requestId;
}
