import { getAuthContext } from '../auth/context.js';
import { runStoreRead, runStoreTransaction } from '../db/store.js';
import { readJsonBody, sendJson } from '../lib/http.js';
import {
  getCompanySettings,
  updateCompanySettings,
} from '../services/company-settings.js';

async function auth(request, response) {
  return (await getAuthContext(request, response)) || null;
}

export async function handleCompanySettingsRoutes(request, response, { pathName }) {
  if (request.method === 'GET' && pathName === '/api/company-settings') {
    const context = await auth(request, response);
    if (!context) return true;
    const payload = await runStoreRead({ prisma: client => getCompanySettings(client, context) });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'PATCH' && pathName === '/api/company-settings') {
    const context = await auth(request, response);
    if (!context) return true;
    const body = await readJsonBody(request);
    const payload = await runStoreTransaction({
      prisma: client => updateCompanySettings(client, context, body),
    });
    sendJson(response, 200, payload);
    return true;
  }

  return false;
}
