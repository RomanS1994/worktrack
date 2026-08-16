import { getDatabaseHealth } from '../db/store.js';
import { sendJson } from '../lib/http.js';
import { nowIso } from '../validation/common.js';

export async function handlePublicRoutes(request, response, { pathName }) {
  if (request.method === 'GET' && pathName === '/api/health') {
    const health = await getDatabaseHealth();

    sendJson(response, health.ok ? 200 : 503, {
      ok: health.ok,
      database: health.database,
      error: health.error || null,
      time: nowIso(),
    });
    return true;
  }

  return false;
}
