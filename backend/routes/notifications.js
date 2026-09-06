import { getAuthContext } from '../auth/context.js';
import { runStoreRead, runStoreTransaction } from '../db/store.js';
import { readJsonBody, sendJson } from '../lib/http.js';
import {
  deletePushSubscription,
  getPushSettings,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  savePushSubscription,
} from '../services/notifications.js';

function cookieValue(request, name) {
  const raw = String(request.headers?.cookie || '');
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function withoutChatNotifications(payload) {
  const notifications = Array.isArray(payload?.notifications)
    ? payload.notifications.filter(notification => notification?.type !== 'chat.message')
    : [];
  return {
    ...payload,
    unreadCount: notifications.filter(notification => !notification.readAt).length,
    notifications,
  };
}

export async function handleNotificationRoutes(request, response, { pathName }) {
  if (request.method === 'GET' && pathName === '/api/notifications') {
    const context = await getAuthContext(request, response);
    if (!context) return true;

    const payload = await runStoreRead({
      prisma: client => listNotifications(client, context),
    });
    sendJson(response, 200, withoutChatNotifications(payload));
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/notifications/push-settings') {
    const context = await getAuthContext(request, response);
    if (!context) return true;
    const payload = await runStoreRead({ prisma: client => getPushSettings(client, context) });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/notifications/push-subscription') {
    const context = await getAuthContext(request, response);
    if (!context) return true;
    const body = await readJsonBody(request);
    const language = body?.language || cookieValue(request, 'worktrack-language');
    const payload = await runStoreTransaction({
      prisma: client => savePushSubscription(
        client,
        context,
        { ...body, language },
        request.headers['user-agent'] || '',
      ),
    });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'DELETE' && pathName === '/api/notifications/push-subscription') {
    const context = await getAuthContext(request, response);
    if (!context) return true;
    const body = await readJsonBody(request);
    const payload = await runStoreTransaction({
      prisma: client => deletePushSubscription(client, context, body?.endpoint),
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
