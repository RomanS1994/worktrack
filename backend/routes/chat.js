import { getAuthContext } from '../auth/context.js';
import { runStoreRead, runStoreTransaction } from '../db/store.js';
import { readJsonBody, sendJson } from '../lib/http.js';
import {
  createChatMessage,
  deleteChatMessage,
  editChatMessage,
  getChatMessageContext,
  getChatReadStates,
  getChatSummary,
  listChatMessages,
  markChatRead,
} from '../services/company-chat.js';
import { getChatReactions, toggleChatReaction } from '../services/chat-reactions.js';
import { broadcastCompanyChat, getCompanyChatPresence, subscribeToCompanyChat } from '../services/chat-live.js';
import { notifyCompanyAboutChatMessage } from '../services/chat-push.js';
import { avatarUrl, avatarUrlFromRecord } from '../services/avatars.js';
import { createChatAttachment, deleteChatAttachment, getChatAttachment } from '../services/chat-attachments.js';
import { createChatRoom, getChatRoomRecipientIds, listChatMembers, listChatRooms } from '../services/chat-rooms.js';

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
    const roomId = url.searchParams.get('roomId') || '';
    const recipients = await runStoreRead({ prisma: client => getChatRoomRecipientIds(client, context, roomId) });
    const companyPresence = getCompanyChatPresence(context.activeMembership.companyId);
    const memberSet = new Set(recipients);
    const membershipIds = companyPresence.membershipIds.filter(id => memberSet.has(id));
    sendJson(response, 200, { membershipIds, onlineCount: membershipIds.length });
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/chat/rooms') {
    const payload = await runStoreRead({ prisma: client => listChatRooms(client, context) });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/chat/members') {
    const payload = await runStoreRead({ prisma: client => listChatMembers(client, context) });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/chat/rooms') {
    const body = await readJsonBody(request);
    const payload = await runStoreTransaction({
      prisma: client => createChatRoom(client, context, body),
    });
    sendJson(response, 201, payload);
    return true;
  }

  const attachmentMatch = pathName.match(/^\/api\/chat\/attachments\/([^/]+)$/);
  if (request.method === 'DELETE' && attachmentMatch) {
    const payload = await runStoreTransaction({
      prisma: client => deleteChatAttachment(client, context, decodeURIComponent(attachmentMatch[1])),
    });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'GET' && attachmentMatch) {
    const attachment = await runStoreRead({
      prisma: client => getChatAttachment(client, context, decodeURIComponent(attachmentMatch[1])),
    });
    const extension = attachment.mimeType === 'image/png' ? 'png' : attachment.mimeType === 'image/webp' ? 'webp' : 'jpg';
    const safeName = String(attachment.fileName || `image.${extension}`).replace(/[\r\n"]/g, '_').slice(0, 100);
    response.writeHead(200, {
      'Content-Type': attachment.mimeType,
      'Content-Length': attachment.data.length,
      'Content-Disposition': `inline; filename="${safeName}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    response.end(attachment.data);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/chat/attachments') {
    const body = await readJsonBody(request);
    const attachment = await runStoreTransaction({
      prisma: client => createChatAttachment(client, context, body),
    });
    sendJson(response, 201, { attachment });
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/chat/read-states') {
    const payload = await runStoreRead({ prisma: client => getChatReadStates(client, context, { roomId: url.searchParams.get('roomId') || '' }) });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/chat/reactions') {
    const messageIds = (url.searchParams.get('messageIds') || '').split(',').filter(Boolean);
    const payload = await runStoreRead({ prisma: client => getChatReactions(client, context, messageIds) });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/chat/reactions') {
    const body = await readJsonBody(request);
    const payload = await runStoreTransaction({
      prisma: async client => {
        const result = await toggleChatReaction(client, context, body);
        const user = await client.user.findUnique({
          where: { id: context.user.id },
          select: { profile: true, avatar: { select: { hash: true } } },
        });
        return {
          ...result,
          memberAvatarDataUrl: avatarUrlFromRecord(context.user.id, user?.avatar) ||
            avatarUrl(context.user.id, user?.profile),
        };
      },
    });
    const recipients = await runStoreRead({ prisma: client => getChatRoomRecipientIds(client, context, payload.roomId || '') });
    broadcastCompanyChat(context.activeMembership.companyId, 'reaction', {
      messageId: payload.messageId,
      emoji: payload.emoji,
      membershipId: context.activeMembership.id,
      active: payload.active,
      replacedEmoji: payload.replacedEmoji || '',
      member: {
        membershipId: context.activeMembership.id,
        name: context.user?.name || context.user?.email || 'User',
        avatarDataUrl: payload.memberAvatarDataUrl || '',
      },
    }, recipients);
    const { memberAvatarDataUrl, ...responsePayload } = payload;
    sendJson(response, 200, responsePayload);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/chat/typing') {
    const body = await readJsonBody(request);
    const recipients = await runStoreRead({ prisma: client => getChatRoomRecipientIds(client, context, body.roomId || '') });
    broadcastCompanyChat(context.activeMembership.companyId, 'typing', {
      roomId: body.roomId || '',
      membershipId: context.activeMembership.id,
      name: context.user?.name || context.user?.email || 'User',
      typing: Boolean(body?.typing),
      at: new Date().toISOString(),
    }, recipients);
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/chat/summary') {
    const payload = await runStoreRead({ prisma: client => getChatSummary(client, context, { roomId: url.searchParams.get('roomId') || '' }) });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/chat/messages') {
    const payload = await runStoreRead({
      prisma: client => listChatMessages(client, context, {
        before: url.searchParams.get('before') || '',
        beforeId: url.searchParams.get('beforeId') || '',
        limit: url.searchParams.get('limit') || 50,
        roomId: url.searchParams.get('roomId') || '',
      }),
    });
    sendJson(response, 200, payload);
    return true;
  }

  const contextMatch = pathName.match(/^\/api\/chat\/messages\/([^/]+)\/context$/);
  if (request.method === 'GET' && contextMatch) {
    const payload = await runStoreRead({
      prisma: client => getChatMessageContext(client, context, contextMatch[1], {
        radius: url.searchParams.get('radius') || 20,
        roomId: url.searchParams.get('roomId') || '',
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
    const recipients = await runStoreRead({ prisma: client => getChatRoomRecipientIds(client, context, payload.message.roomId || body.roomId || '') });
    broadcastCompanyChat(context.activeMembership.companyId, 'message', payload.message, recipients);
    if (!payload.duplicate) {
      void runStoreRead({
        prisma: client => notifyCompanyAboutChatMessage(client, context, payload.message),
      }).catch(error => {
        console.warn('Chat notification delivery failed:', error instanceof Error ? error.message : String(error));
      });
    }
    sendJson(response, payload.duplicate ? 200 : 201, payload);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/chat/read') {
    const body = await readJsonBody(request);
    const payload = await runStoreTransaction({ prisma: client => markChatRead(client, context, body) });
    const recipients = await runStoreRead({ prisma: client => getChatRoomRecipientIds(client, context, body.roomId || '') });
    broadcastCompanyChat(context.activeMembership.companyId, 'read', {
      roomId: body.roomId || '',
      membershipId: context.activeMembership.id,
      lastReadAt: payload.lastReadAt,
    }, recipients);
    sendJson(response, 200, payload);
    return true;
  }

  const deleteMatch = pathName.match(/^\/api\/chat\/messages\/([^/]+)$/);
  if (request.method === 'PATCH' && deleteMatch) {
    const body = await readJsonBody(request);
    const roomId = url.searchParams.get('roomId') || body.roomId || '';
    const payload = await runStoreTransaction({
      prisma: client => editChatMessage(client, context, decodeURIComponent(deleteMatch[1]), roomId, body.body),
    });
    const recipients = await runStoreRead({ prisma: client => getChatRoomRecipientIds(client, context, roomId) });
    broadcastCompanyChat(context.activeMembership.companyId, 'edit', {
      roomId,
      message: payload.message,
      membershipId: context.activeMembership.id,
    }, recipients);
    sendJson(response, 200, payload);
    return true;
  }
  if (request.method === 'DELETE' && deleteMatch) {
    const payload = await runStoreTransaction({
      prisma: client => deleteChatMessage(client, context, deleteMatch[1], url.searchParams.get('roomId') || ''),
    });
    const recipients = await runStoreRead({ prisma: client => getChatRoomRecipientIds(client, context, url.searchParams.get('roomId') || '') });
    broadcastCompanyChat(context.activeMembership.companyId, 'delete', {
      roomId: url.searchParams.get('roomId') || '',
      ...payload,
      membershipId: context.activeMembership.id,
    }, recipients);
    sendJson(response, 200, payload);
    return true;
  }

  return false;
}
