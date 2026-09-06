import { getAuthContext } from '../auth/context.js';
import { runStoreRead, runStoreTransaction } from '../db/store.js';
import { readJsonBody, sendJson } from '../lib/http.js';
import {
  createChatMessage,
  deleteChatMessage,
  getChatSummary,
  listChatMessages,
  markChatRead,
} from '../services/company-chat.js';
import { broadcastCompanyChat, getCompanyChatPresence, subscribeToCompanyChat } from '../services/chat-live.js';
import { notifyCompanyAboutChatMessage } from '../services/chat-push.js';

export async function handleChatRoutes(request, response, { url, pathName }) {
  if (!pathName.startsWith('/api/chat')) return false;

  const context = await getAuthContext(request, response);
  if (!context) return true;

  if (request.method === 'GET' && pathName === '/api/chat/stream') {
    subscribeToCompanyChat(
      request,
      response,
      context.activeMembership.companyId,
      context.activeMembership.id,
    );
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/chat/presence') {
    sendJson(response, 200, getCompanyChatPresence(context.activeMembership.companyId));
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/chat/summary') {
    const payload = await runStoreRead({ prisma: client => getChatSummary(client, context) });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/chat/messages') {
    const payload = await runStoreRead({
      prisma: client => listChatMessages(client, context, {
        before: url.searchParams.get('before') || '',
        limit: url.searchParams.get('limit') || 50,
      }),
    });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/chat/messages') {
    const body = await readJsonBody(request);
    const payload = await runStoreTransaction({
      prisma: client => createChatMessage(client, context, body),
    });
    broadcastCompanyChat(context.activeMembership.companyId, 'message', payload.message);
    if (!payload.duplicate) {
      void runStoreRead({ prisma: client => notifyCompanyAboutChatMessage(client, context, payload.message) });
    }
    sendJson(response, payload.duplicate ? 200 : 201, payload);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/chat/read') {
    const body = await readJsonBody(request);
    const payload = await runStoreTransaction({ prisma: client => markChatRead(client, context, body) });
    broadcastCompanyChat(context.activeMembership.companyId, 'read', {
      membershipId: context.activeMembership.id,
      lastReadAt: payload.lastReadAt,
    });
    sendJson(response, 200, payload);
    return true;
  }

  const deleteMatch = pathName.match(/^\/api\/chat\/messages\/([^/]+)$/);
  if (request.method === 'DELETE' && deleteMatch) {
    const payload = await runStoreTransaction({
      prisma: client => deleteChatMessage(client, context, deleteMatch[1]),
    });
    broadcastCompanyChat(context.activeMembership.companyId, 'delete', payload);
    sendJson(response, 200, payload);
    return true;
  }

  return false;
}
