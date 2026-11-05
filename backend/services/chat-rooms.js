import { randomUUID } from 'node:crypto';
import { avatarUrl, avatarUrlFromRecord } from './avatars.js';

function getMembership(context) {
  const membership = context?.activeMembership;
  if (!membership?.id || !membership?.companyId || membership.status === 'INACTIVE') {
    throw new Error('Company access is required');
  }
  return membership;
}

function requireManager(context) {
  const membership = getMembership(context);
  if (membership.role !== 'MANAGER') throw new Error('Manager access is required');
  return membership;
}

function memberAvatar(row) {
  return avatarUrlFromRecord(row.userId, { hash: row.avatarHash }) || avatarUrl(row.userId, row.avatarDataUrl);
}

async function getRoom(client, context, roomId) {
  const membership = getMembership(context);
  const roomRows = await client.$queryRaw`
    SELECT r.id, r.name, r.type, r.created_at AS "createdAt", r.updated_at AS "updatedAt",
      (SELECT COUNT(*)::int FROM company_memberships cm
        LEFT JOIN chat_room_members rm ON rm.membership_id = cm.id AND rm.room_id = r.id
        WHERE cm."companyId" = r.company_id AND cm.status = 'ACTIVE' AND cm."deletedAt" IS NULL
          AND (r.type = 'COMPANY' OR (rm.room_id IS NOT NULL AND rm.left_at IS NULL))) AS "memberCount",
      (SELECT COUNT(*)::int FROM chat_messages unread
        LEFT JOIN chat_read_states rs ON rs.room_id = r.id AND rs.membership_id = ${membership.id}
        WHERE unread.room_id = r.id AND unread.deleted_at IS NULL
          AND unread.author_membership_id <> ${membership.id}
          AND unread.created_at > COALESCE(rs.last_read_at, 'epoch'::timestamptz)) AS "unreadCount",
      (SELECT jsonb_build_object('id', lm.id, 'body', CASE WHEN lm.deleted_at IS NOT NULL THEN '' ELSE lm.body END,
          'createdAt', lm.created_at, 'authorMembershipId', lm.author_membership_id)
        FROM chat_messages lm WHERE lm.room_id = r.id
        ORDER BY lm.created_at DESC, lm.id DESC LIMIT 1) AS "lastMessage"
    FROM chat_rooms r
    JOIN company_memberships current_member ON current_member.id = ${membership.id}
      AND current_member."companyId" = r.company_id AND current_member.status = 'ACTIVE'
      AND current_member."deletedAt" IS NULL
    LEFT JOIN chat_room_members self ON self.room_id = r.id AND self.membership_id = ${membership.id}
    WHERE r.id = ${roomId} AND r.company_id = ${membership.companyId}
      AND (r.type = 'COMPANY' OR (self.room_id IS NOT NULL AND self.left_at IS NULL))
    LIMIT 1`;
  if (!roomRows[0]) throw new Error('Chat room not found');
  const room = roomRows[0];
  const participants = await client.$queryRaw`
    SELECT cm.id AS "membershipId", cm.role::text AS role, u.id AS "userId", u.name, u.email,
      u.profile ->> 'avatarDataUrl' AS "avatarDataUrl", ua.hash AS "avatarHash"
    FROM chat_rooms r
    JOIN company_memberships cm ON cm."companyId" = r.company_id
    JOIN users u ON u.id = cm."userId"
    LEFT JOIN chat_room_members rm ON rm.room_id = r.id AND rm.membership_id = cm.id
    LEFT JOIN user_avatars ua ON ua."userId" = u.id
    WHERE r.id = ${roomId} AND (r.type = 'COMPANY' OR (rm.room_id IS NOT NULL AND rm.left_at IS NULL)) AND cm.status = 'ACTIVE'
      AND cm."deletedAt" IS NULL AND u."deletedAt" IS NULL
    ORDER BY CASE WHEN cm.role = 'MANAGER' THEN 0 ELSE 1 END, lower(COALESCE(u.name, u.email))`;
  return {
    id: room.id,
    name: room.name,
    type: room.type,
    createdAt: new Date(room.createdAt).toISOString(),
    updatedAt: new Date(room.updatedAt).toISOString(),
    memberCount: Number(room.memberCount || 0),
    unreadCount: Number(room.unreadCount || 0),
    lastMessage: room.lastMessage ? {
      ...room.lastMessage,
      createdAt: new Date(room.lastMessage.createdAt).toISOString(),
    } : null,
    participants: participants.map(row => ({
      membershipId: row.membershipId,
      name: row.name || row.email || 'User',
      role: row.role,
      avatarDataUrl: memberAvatar(row),
    })),
  };
}

export async function requireChatRoom(client, context, requestedRoomId = '') {
  const membership = getMembership(context);
  const roomId = String(requestedRoomId || '').trim();
  const rows = await client.$queryRaw`
    SELECT r.id, r.type
      FROM chat_rooms r
      JOIN company_memberships cm ON cm.id = ${membership.id} AND cm."companyId" = r.company_id
      LEFT JOIN chat_room_members rm ON rm.room_id = r.id AND rm.membership_id = cm.id
     WHERE r.company_id = ${membership.companyId}
       AND cm.status = 'ACTIVE' AND cm."deletedAt" IS NULL
       AND (r.type = 'COMPANY' OR rm.left_at IS NULL AND rm.room_id IS NOT NULL)
       AND (${roomId} = '' OR r.id = ${roomId})
     ORDER BY CASE WHEN r.type = 'COMPANY' THEN 0 ELSE 1 END
     LIMIT 1`;
  if (!rows[0]) throw new Error('Chat room not found');
  return rows[0];
}

export async function getChatRoomRecipientIds(client, context, requestedRoomId = '') {
  const room = await requireChatRoom(client, context, requestedRoomId);
  const rows = await client.$queryRaw`
    SELECT rm.membership_id AS "membershipId"
      FROM chat_rooms r
      JOIN company_memberships cm ON cm."companyId" = r.company_id
      LEFT JOIN chat_room_members rm ON rm.room_id = r.id AND rm.membership_id = cm.id
     WHERE r.id = ${room.id} AND (r.type = 'COMPANY' OR rm.left_at IS NULL AND rm.room_id IS NOT NULL)
       AND cm.status = 'ACTIVE' AND cm."deletedAt" IS NULL`;
  return rows.map(row => row.membershipId);
}

export async function listChatRooms(client, context) {
  const membership = getMembership(context);
  const rows = await client.$queryRaw`
    SELECT r.id
    FROM chat_rooms r
    LEFT JOIN chat_room_members rm ON rm.room_id = r.id AND rm.membership_id = ${membership.id}
    WHERE r.company_id = ${membership.companyId}
      AND (r.type = 'COMPANY' OR rm.left_at IS NULL AND rm.room_id IS NOT NULL)
    ORDER BY r.updated_at DESC, r.id`;
  const rooms = [];
  for (const row of rows) rooms.push(await getRoom(client, context, row.id));
  return { rooms };
}

export async function listChatMembers(client, context) {
  const membership = requireManager(context);
  const rows = await client.$queryRaw`
    SELECT cm.id AS "membershipId", cm.role::text AS role, u.id AS "userId", u.name, u.email,
      u.profile ->> 'avatarDataUrl' AS "avatarDataUrl", ua.hash AS "avatarHash"
    FROM company_memberships cm
    JOIN users u ON u.id = cm."userId"
    LEFT JOIN user_avatars ua ON ua."userId" = u.id
    WHERE cm."companyId" = ${membership.companyId} AND cm.role IN ('EMPLOYEE', 'MANAGER')
      AND cm.status = 'ACTIVE' AND cm."deletedAt" IS NULL AND u."deletedAt" IS NULL
    ORDER BY lower(COALESCE(u.name, u.email)), cm.id`;
  return { members: rows.map(row => ({
    membershipId: row.membershipId,
    name: row.name || row.email || 'User',
    role: row.role,
    avatarDataUrl: memberAvatar(row),
  })) };
}

export async function createChatRoom(client, context, { name = '', memberIds = [] } = {}) {
  const membership = requireManager(context);
  const safeName = String(name).trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!safeName) throw new Error('Chat name is required');
  if (!Array.isArray(memberIds)) throw new Error('Chat members must be a list');
  const selectedIds = [...new Set(memberIds.map(value => String(value || '').trim()).filter(Boolean))];
  if (selectedIds.length > 99) throw new Error('Too many chat members');
  const memberRows = selectedIds.length ? await client.companyMembership.findMany({
    where: {
      id: { in: selectedIds },
      companyId: membership.companyId,
      role: { in: ['EMPLOYEE', 'MANAGER'] },
      status: 'ACTIVE',
      deletedAt: null,
      user: { is: { deletedAt: null } },
    },
    select: { id: true },
  }) : [];
  if (memberRows.length !== selectedIds.length) throw new Error('One or more selected chat members are unavailable');

  const id = randomUUID();
  await client.$executeRaw`
    INSERT INTO chat_rooms (id, company_id, name, type, created_by_membership_id)
    VALUES (${id}, ${membership.companyId}, ${safeName}, 'GROUP', ${membership.id})`;
  const participants = [...new Set([membership.id, ...selectedIds])];
  for (const participantId of participants) {
    await client.$executeRaw`
      INSERT INTO chat_room_members (room_id, membership_id, added_by_membership_id)
      VALUES (${id}, ${participantId}, ${membership.id})`;
  }
  return { room: await getRoom(client, context, id) };
}
