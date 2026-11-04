import assert from 'node:assert/strict';
import test from 'node:test';
import { parseChatImage, getChatAttachment, attachChatFilesToMessage, deleteChatAttachment, createChatAttachment } from '../services/chat-attachments.js';

const png = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
const asDataUrl = (buffer, mime = 'image/png') => `data:${mime};base64,${buffer.toString('base64')}`;

test('chat image parser accepts png, sanitizes filename, and validates magic bytes', () => {
  const parsed = parseChatImage({ dataUrl: asDataUrl(png), fileName: '../../bad\nname.png' });
  assert.equal(parsed.mimeType, 'image/png');
  assert.equal(parsed.fileName.includes('/'), false);
  assert.equal(parsed.fileName.includes('\n'), false);
  assert.throws(() => parseChatImage({ dataUrl: asDataUrl(png, 'image/jpeg') }), /Invalid chat attachment/);
});

test('chat image parser rejects unsupported and oversized payloads', () => {
  assert.throws(() => parseChatImage({ dataUrl: 'data:image/gif;base64,AAAA' }), /Invalid chat attachment/);
  const oversized = Buffer.alloc(Math.floor(2.5 * 1024 * 1024) + 1, 1);
  assert.throws(() => parseChatImage({ dataUrl: asDataUrl(oversized) }), /too large/);
});

test('attachment download is scoped to active company', async () => {
  const client = { $queryRaw: async (...args) => {
    const values = args.slice(1);
    assert.deepEqual(values, ['file-1', 'company-1', 'member-1']);
    assert.match(args[0].join(''), /message_id IS NULL AND a\.uploader_membership_id/);
    assert.match(args[0].join(''), /m\.deleted_at IS NULL/);
    return [];
  } };
  await assert.rejects(getChatAttachment(client, { activeMembership: { id: 'member-1', companyId: 'company-1', status: 'ACTIVE' } }, 'file-1'), /not found/);
});

test('attachment association rejects a concurrent claim when fewer rows update', async () => {
  let updateCalls = 0;
  const client = {
    $queryRaw: async () => [{ id: 'file-1' }],
    $executeRaw: async () => { updateCalls += 1; return 0; },
  };
  await assert.rejects(
    attachChatFilesToMessage(client, { activeMembership: { id: 'member-1', companyId: 'company-1', status: 'ACTIVE' } }, 'message-1', ['file-1']),
    /not found/,
  );
  assert.equal(updateCalls, 1);
});

test('attachment association rejects files from another company or uploader', async () => {
  const client = { $queryRaw: async () => [] };
  await assert.rejects(
    attachChatFilesToMessage(client, { activeMembership: { id: 'member-1', companyId: 'company-1', status: 'ACTIVE' } }, 'message-1', ['foreign-file']),
    /not found/,
  );
});

test('attachment cleanup is limited to the uploader company and unassociated files', async () => {
  const client = { $executeRaw: async (...args) => {
    const sql = args[0].join('?');
    assert.match(sql, /company_id = \?/);
    assert.match(sql, /uploader_membership_id = \?/);
    assert.match(sql, /message_id IS NULL/);
    assert.deepEqual(args.slice(1), ['file-1', 'company-1', 'member-1']);
    return 0;
  } };
  await assert.rejects(
    deleteChatAttachment(client, { activeMembership: { id: 'member-1', companyId: 'company-1', status: 'ACTIVE' } }, 'file-1'),
    /not found/,
  );
});

test('new upload opportunistically removes a bounded batch of abandoned uploads', async () => {
  const statements = [];
  const client = { $executeRaw: async (...args) => { statements.push(args[0].join('')); return 0; } };
  const uploaded = await createChatAttachment(client, { activeMembership: { id: 'member-1', companyId: 'company-1', status: 'ACTIVE' } }, { dataUrl: asDataUrl(png), fileName: 'site.png' });
  assert.equal(statements.length, 2);
  assert.match(statements[0], /INTERVAL '24 hours'/);
  assert.match(statements[0], /LIMIT 100/);
  assert.equal(uploaded.mimeType, 'image/png');
});
