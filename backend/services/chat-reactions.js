const ALLOWED_REACTIONS = new Set(['👍', '❤️', '😂', '😮', '😢', '🙏']);

function getMembership(context) {
  const membership = context?.activeMembership;
  if (!membership?.id || !membership?.companyId || membership.status === 'INACTIVE') {
    throw new Error('Company access is required');
  }
  return membership;
}

function normalizeMessageIds(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(source.map(item => String(item || '').trim()).filter(Boolean))].slice(0, 100);
}

export async function getChatReactions(client, context, messageIds = []) {
  const membership = getMembership(context);
  const ids = normalizeMessageIds(messageIds);
  if (!ids.length) return { byMessage: {} };

  const rows = await client.$queryRaw`
    SELECT r.message_id AS "messageId",
           r.membership_id AS "membershipId",
           r.emoji,
           u.name AS "name",
           u.email AS "email"
      FROM chat_message_reactions r
      JOIN chat_messages m ON m.id = r.message_id
      JOIN company_memberships cm ON cm.id = r.membership_id
      JOIN users u ON u.id = cm."userId"
     WHERE r.message_id = ANY(${ids}::text[])
       AND m.company_id = ${membership.companyId}
       AND m.deleted_at IS NULL
     ORDER BY r.created_at ASC
  `;

  const grouped = {};
  for (const row of rows) {
    const messageId = row.messageId;
    const list = grouped[messageId] || (grouped[messageId] = []);
    let reaction = list.find(item => item.emoji === row.emoji);
    if (!reaction) {
      reaction = { emoji: row.emoji, count: 0, mine: false, names: [] };
      list.push(reaction);
    }
    reaction.count += 1;
    reaction.mine ||= row.membershipId === membership.id;
    const name = row.name || row.email || 'User';
    if (!reaction.names.includes(name)) reaction.names.push(name);
  }

  return { byMessage: grouped };
}

export async function toggleChatReaction(client, context, body = {}) {
  const membership = getMembership(context);
  const messageId = String(body.messageId || '').trim().slice(0, 120);
  const emoji = String(body.emoji || '').trim();
  if (!messageId) throw new Error('Chat message is required');
  if (!ALLOWED_REACTIONS.has(emoji)) throw new Error('Unsupported chat reaction');

  const messageRows = await client.$queryRaw`
    SELECT id
      FROM chat_messages
     WHERE id = ${messageId}
       AND company_id = ${membership.companyId}
       AND deleted_at IS NULL
     LIMIT 1
  `;
  if (!messageRows[0]?.id) throw new Error('Chat message not found');

  const existingRows = await client.$queryRaw`
    SELECT 1
      FROM chat_message_reactions
     WHERE message_id = ${messageId}
       AND membership_id = ${membership.id}
       AND emoji = ${emoji}
     LIMIT 1
  `;

  if (existingRows.length) {
    await client.$executeRaw`
      DELETE FROM chat_message_reactions
       WHERE message_id = ${messageId}
         AND membership_id = ${membership.id}
         AND emoji = ${emoji}
    `;
    return { ok: true, messageId, emoji, active: false };
  }

  await client.$executeRaw`
    INSERT INTO chat_message_reactions (message_id, membership_id, emoji)
    VALUES (${messageId}, ${membership.id}, ${emoji})
    ON CONFLICT (message_id, membership_id, emoji) DO NOTHING
  `;
  return { ok: true, messageId, emoji, active: true };
}
