import { getAuthContext } from '../auth/context.js';
import { runStoreRead, runStoreTransaction } from '../db/store.js';
import { sendJson } from '../lib/http.js';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notifications.js';

export async function handleNotificationRoutes(request, response, { pathName }) {
  if (request.method === 'GET' && pathName === '/api/notifications') {
    const context = await getAuthContext(request, response);
    if (!context) return true;

    const payload = await runStoreRead({
      prisma: client => listNotifications(client, context),
    });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/notifications/read-all') {
    const context = await getAuthContext(request, response);
    if (!context) return true;

    const payload = await runStoreTransaction({
      prisma: client => markAllNotificationsRead(client, context),
    });
    sendJson(response, 200, payload);
    return true;
  }

  const readMatch = pathName.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (request.method === 'POST' && readMatch) {
    const context = await getAuthContext(request, response);
    if (!context) return true;

    const notification = await runStoreTransaction({
      prisma: client => markNotificationRead(client, context, readMatch[1]),
    });
    sendJson(response, 200, { notification });
    return true;
  }

  return false;
}
