import { randomUUID } from 'node:crypto';

function getMembership(context) {
  const membership = context?.activeMembership;
  if (!membership?.id || !membership?.companyId || membership.status === 'INACTIVE') {
    throw new Error('Company access is required');
  }
  return membership;
}

function avatarFromProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return '';
  return typeof profile.avatarDataUrl === 'string' ? profile.avatarDataUrl : '';
}

function serializeRow(row) {
  return {
    id: row.id,
    companyId: row.companyId,
    authorMembershipId: row.authorMembershipId,
    clientMessageId: row.clientMessageId || '',
    body: row.body,
    createdAt: new Date(row.createdAt).toISOString(),
    editedAt: row.editedAt ? new Date(row.editedAt).toISOString() : '',
    deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : '',
    author: {
      membershipId: row.authorMembershipId,
      name: row.authorName || row.authorEmail || 'User',
      role: row.authorRole || '',
      avatarDataUrl: avatarFromProfile(row.authorProfile),
    },
  };
}

async function findMessage(client, companyId, id) {
  const rows = await client.$queryRaw`
    SELECT m.id,
           m.company_id AS "companyId",
           m.author_membership_id AS "authorMembershipId",
           m.client_message_id AS "clientMessageId",
           m.body,
           m.created_at AS "createdAt",
           m.edited_at AS "editedAt",
           m.deleted_at AS "deletedAt",
           u.name AS "authorName",
           u.email AS "authorEmail",
           u.profile AS "authorProfile",
           cm.role::text AS "authorRole"
      FROM chat_messages m
      JOIN company_memberships cm ON cm.id = m.author_membership_id
      JOIN users u ON u.id = cm."userId"
     WHERE m.company_id = ${companyId}
       AND m.id = ${id}
     LIMIT 1
  `;
  return rows[0] || null;
}

export async function listChatMessages(client, context, { before = '', limit = 50 } = {}) {
  const membership = getMembership(context);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const beforeDate = before ? new Date(before) : null;
  if (before && Number.isNaN(beforeDate.getTime())) throw new Error('Invalid chat cursor');

  const rows = beforeDate
    ? await client.$queryRaw`
        SELECT m.id,
               m.company_id AS "companyId",
               m.author_membership_id AS "authorMembershipId",
               m.client_message_id AS "clientMessageId",
               m.body,
               m.created_at AS "createdAt",
               m.edited_at AS "editedAt",
               m.deleted_at AS "deletedAt",
               u.name AS "authorName",
               u.email AS "authorEmail",
               u.profile AS "authorProfile",
               cm.role::text AS "authorRole"
          FROM chat_messages m
          JOIN company_memberships cm ON cm.id = m.author_membership_id
          JOIN users u ON u.id = cm."userId"
         WHERE m.company_id = ${membership.companyId}
           AND m.deleted_at IS NULL
           AND m.created_at < ${beforeDate}
         ORDER BY m.created_at DESC
         LIMIT ${safeLimit}
      `
    : await client.$queryRaw`
        SELECT m.id,
               m.company_id AS "companyId",
               m.author_membership_id AS "authorMembershipId",
               m.client_message_id AS "clientMessageId",
               m.body,
               m.created_at AS "createdAt",
               m.edited_at AS "editedAt",
               m.deleted_at AS "deletedAt",
               u.name AS "authorName",
               u.email AS "authorEmail",
               u.profile AS "authorProfile",
               cm.role::text AS "authorRole"
          FROM chat_messages m
          JOIN company_memberships cm ON cm.id = m.author_membership_id
          JOIN users u ON u.id = cm."userId"
         WHERE m.company_id = ${membership.companyId}
           AND m.deleted_at IS NULL
         ORDER BY m.created_at DESC
         LIMIT ${safeLimit}
      `;

  const ordered = rows.map(serializeRow).reverse();
  return { messages: ordered, hasMore: rows.length === safeLimit };
}

export async function getChatSummary(client, context) {
  const membership = getMembership(context);
  const stateRows = await client.$queryRaw`
    SELECT last_read_at AS "lastReadAt"
      FROM chat_read_states
     WHERE membership_id = ${membership.id}
     LIMIT 1
  `;
  const lastReadAt = stateRows[0]?.lastReadAt ? new Date(stateRows[0].lastReadAt) : new Date(0);
  const countRows = await client.$queryRaw`
    SELECT COUNT(*)::int AS count
      FROM chat_messages
     WHERE company_id = ${membership.companyId}
       AND author_membership_id <> ${membership.id}
       AND deleted_at IS NULL
       AND created_at > ${lastReadAt}
  `;
  const latestRows = await client.$queryRaw`
    SELECT created_at AS "createdAt"
      FROM chat_messages
     WHERE company_id = ${membership.companyId}
       AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1
  `;
  return {
    unreadCount: Number(countRows[0]?.count || 0),
    lastMessageAt: latestRows[0]?.createdAt ? new Date(latestRows[0].createdAt).toISOString() : '',
    lastReadAt: lastReadAt.getTime() > 0 ? lastReadAt.toISOString() : '',
  };
}

export async function getChatReadStates(client, context) {
  const membership = getMembership(context);
  const rows = await client.$queryRaw`
    SELECT s.membership_id AS "membershipId",
           s.last_read_at AS "lastReadAt",
           u.name AS "name",
           u.email AS "email"
      FROM chat_read_states s
      JOIN company_memberships cm ON cm.id = s.membership_id
      JOIN users u ON u.id = cm."userId"
     WHERE s.company_id = ${membership.companyId}
       AND s.membership_id <> ${membership.id}
       AND cm.status = 'ACTIVE'
       AND cm.deleted_at IS NULL
       AND u.deleted_at IS NULL
  `;
  return {
    states: rows.map(row => ({
      membershipId: row.membershipId,
      lastReadAt: new Date(row.lastReadAt).toISOString(),
      name: row.name || row.email || 'User',
    })),
  };
}

export async function createChatMessage(client, context, body = {}) {
  const membership = getMembership(context);
  const messageBody = String(body.body || '').trim();
  if (!messageBody) throw new Error('Message is required');
  if (messageBody.length > 4000) throw new Error('Message is too long');
  const clientMessageId = String(body.clientMessageId || '').trim().slice(0, 120) || null;

  if (clientMessageId) {
    const existing = await client.$queryRaw`
      SELECT id FROM chat_messages
       WHERE author_membership_id = ${membership.id}
         AND client_message_id = ${clientMessageId}
       LIMIT 1
    `;
    if (existing[0]?.id) {
      const row = await findMessage(client, membership.companyId, existing[0].id);
      return { message: serializeRow(row), duplicate: true };
    }
  }

  const id = randomUUID();
  await client.$executeRaw`
    INSERT INTO chat_messages (id, company_id, author_membership_id, client_message_id, body)
    VALUES (${id}, ${membership.companyId}, ${membership.id}, ${clientMessageId}, ${messageBody})
  `;
  const row = await findMessage(client, membership.companyId, id);
  return { message: serializeRow(row), duplicate: false };
}

export async function markChatRead(client, context, body = {}) {
  const membership = getMembership(context);
  const requested = body.readAt ? new Date(body.readAt) : new Date();
  if (Number.isNaN(requested.getTime())) throw new Error('Invalid read timestamp');
  await client.$executeRaw`
    INSERT INTO chat_read_states (membership_id, company_id, last_read_at, updated_at)
    VALUES (${membership.id}, ${membership.companyId}, ${requested}, CURRENT_TIMESTAMP)
    ON CONFLICT (membership_id)
    DO UPDATE SET
      company_id = EXCLUDED.company_id,
      last_read_at = GREATEST(chat_read_states.last_read_at, EXCLUDED.last_read_at),
      updated_at = CURRENT_TIMESTAMP
  `;
  return { ok: true, lastReadAt: requested.toISOString() };
}

export async function deleteChatMessage(client, context, messageId) {
  const membership = getMembership(context);
  const row = await findMessage(client, membership.companyId, messageId);
  if (!row || row.deletedAt) throw new Error('Chat message not found');
  const canDelete = row.authorMembershipId === membership.id || membership.role === 'MANAGER';
  if (!canDelete) throw new Error('Cannot delete this message');
  const deletedAt = new Date();
  await client.$executeRaw`
    UPDATE chat_messages
       SET deleted_at = ${deletedAt}
     WHERE id = ${row.id}
       AND company_id = ${membership.companyId}
  `;
  return { ok: true, id: row.id, deletedAt: deletedAt.toISOString() };
}
