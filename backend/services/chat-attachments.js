import { randomUUID } from 'node:crypto';

const MIME_EXTENSIONS = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);
const MAX_BYTES = 2.5 * 1024 * 1024;

function membership(context) {
  const value = context?.activeMembership;
  if (!value?.id || !value?.companyId || value.status === 'INACTIVE') throw new Error('Company access is required');
  return value;
}

function detectMime(data) {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return '';
}

function safeName(value, mime) {
  const ext = MIME_EXTENSIONS.get(mime);
  const base = String(value || '').replace(/\\/g, '/').split('/').pop().replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/[\r\n"]/g, '_').trim().slice(0, 100);
  return base || `image.${ext}`;
}

export function parseChatImage(input) {
  const dataUrl = String(input?.dataUrl || '').trim();
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) throw new Error('Invalid chat attachment');
  const data = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!data.length) throw new Error('Invalid chat attachment');
  if (data.length > MAX_BYTES) throw new Error('Chat attachment is too large');
  const mimeType = detectMime(data);
  if (!mimeType || mimeType !== match[1]) throw new Error('Invalid chat attachment');
  return { data, mimeType, fileName: safeName(input?.fileName, mimeType) };
}

export async function createChatAttachment(client, context, input) {
  const user = membership(context);
  const parsed = parseChatImage(input);
  await client.$executeRaw`
    WITH stale AS (
      SELECT id FROM chat_attachments
       WHERE message_id IS NULL AND created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
       ORDER BY created_at ASC
       LIMIT 100
    )
    DELETE FROM chat_attachments a USING stale WHERE a.id = stale.id
  `;
  const id = randomUUID();
  await client.$executeRaw`
    INSERT INTO chat_attachments (id, company_id, uploader_membership_id, file_name, mime_type, file_data)
    VALUES (${id}, ${user.companyId}, ${user.id}, ${parsed.fileName}, ${parsed.mimeType}, ${parsed.data})
  `;
  return { id, fileName: parsed.fileName, mimeType: parsed.mimeType, size: parsed.data.length, url: `/api/chat/attachments/${id}` };
}

export async function deleteChatAttachment(client, context, id) {
  const user = membership(context);
  const count = await client.$executeRaw`
    DELETE FROM chat_attachments
     WHERE id = ${String(id || '').slice(0, 120)}
       AND company_id = ${user.companyId}
       AND uploader_membership_id = ${user.id}
       AND message_id IS NULL
  `;
  if (!count) throw new Error('Chat attachment not found');
  return { ok: true };
}

export async function getChatAttachment(client, context, id) {
  const user = membership(context);
  const rows = await client.$queryRaw`
    SELECT a.id, a.file_name AS "fileName", a.mime_type AS "mimeType", a.file_data AS data
      FROM chat_attachments a
      LEFT JOIN chat_messages m ON m.id = a.message_id AND m.company_id = a.company_id
     WHERE a.id = ${String(id || '').slice(0, 120)} AND a.company_id = ${user.companyId}
       AND ((a.message_id IS NULL AND a.uploader_membership_id = ${user.id})
         OR (a.message_id IS NOT NULL AND m.id IS NOT NULL AND m.deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM chat_rooms r
             LEFT JOIN chat_room_members rm ON rm.room_id = r.id AND rm.membership_id = ${user.id}
             WHERE r.id = m.room_id AND (r.type = 'COMPANY' OR (rm.room_id IS NOT NULL AND rm.left_at IS NULL)))))
     LIMIT 1
  `;
  if (!rows[0]) throw new Error('Chat attachment not found');
  return rows[0];
}

export async function attachChatFilesToMessage(client, context, messageId, ids) {
  const user = membership(context);
  const unique = [...new Set((Array.isArray(ids) ? ids : []).map(id => String(id || '').trim()).filter(Boolean))];
  if (unique.length > 5) throw new Error('Too many chat attachments');
  if (!unique.length) return;
  const rows = await client.$queryRaw`
    SELECT id FROM chat_attachments
     WHERE id = ANY(${unique}::text[]) AND company_id = ${user.companyId}
       AND uploader_membership_id = ${user.id} AND message_id IS NULL
  `;
  if (rows.length !== unique.length) throw new Error('Chat attachment not found');
  const updated = await client.$executeRaw`
    UPDATE chat_attachments SET message_id = ${messageId}
     WHERE id = ANY(${unique}::text[]) AND company_id = ${user.companyId}
       AND uploader_membership_id = ${user.id} AND message_id IS NULL
  `;
  if (updated !== unique.length) throw new Error('Chat attachment not found');
}

export async function listChatAttachments(client, companyId, messageIds) {
  const ids = [...new Set(messageIds.filter(Boolean))];
  if (!ids.length) return {};
  const rows = await client.$queryRaw`
    SELECT id, message_id AS "messageId", file_name AS "fileName", mime_type AS "mimeType", octet_length(file_data) AS size
      FROM chat_attachments
     WHERE company_id = ${companyId} AND message_id = ANY(${ids}::text[])
     ORDER BY created_at, id
  `;
  return rows.reduce((result, row) => {
    (result[row.messageId] ||= []).push({ id: row.id, fileName: row.fileName, mimeType: row.mimeType, size: Number(row.size), url: `/api/chat/attachments/${row.id}` });
    return result;
  }, {});
}
