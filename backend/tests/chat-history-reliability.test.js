import assert from 'node:assert/strict';
import test from 'node:test';
import { listChatMessages, createChatMessage } from '../services/company-chat.js';

const context = { user: { id: 'user', name: 'Test' },
  activeMembership: { id: 'member', companyId: 'company', status: 'ACTIVE' } };
const row = (id, date = '2026-10-22T08:00:00.000Z') => ({
  id, createdAt: new Date(date), companyId: 'company', authorMembershipId: 'member',
  authorName: 'Test', body: id,
});

test('afterId replays more than 50 missed messages in deterministic ascending pages', async () => {
  // All messages share a timestamp so the id tie-break is necessary.
  const rows = Array.from({ length: 152 }, (_, i) => row(String(i).padStart(4, '0')));
  const seenQueries = [];
  const client = {
    $queryRaw: async () => [], // reaction query
    async $queryRawUnsafe(sql, company, ...values) {
      assert.equal(company, 'company');
      seenQueries.push(sql);
      if (sql.startsWith('SELECT id, created_at')) {
        assert.doesNotMatch(sql, /deleted_at/); // even a soft-deleted cursor resolves
        return rows.filter(item => item.id === values[0]);
      }
      assert.match(sql, /\(m\.created_at, m\.id\) > \(\$2, \$3\)/);
      assert.match(sql, /ORDER BY m\.created_at ASC, m\.id ASC/);
      assert.match(sql, /m\.deleted_at IS NULL/);
      const [, afterId, limit] = values;
      return rows.filter(item => item.id > afterId).slice(0, limit);
    },
  };
  let cursor = '0000';
  const received = [];
  let more;
  do {
    const page = await listChatMessages(client, context, { afterId: cursor, limit: 50 });
    assert.equal(page.afterId, cursor);
    received.push(...page.messages.map(item => item.id));
    cursor = page.messages.at(-1)?.id || cursor;
    more = page.hasMore;
  } while (more);
  assert.equal(received.length, 151);
  assert.equal(new Set(received).size, 151);
  assert.deepEqual(received, rows.slice(1).map(item => item.id));
  assert.equal(seenQueries.length, 8);
});

test('afterId never falls back to latest history for an unknown or foreign-company cursor', async () => {
  let calls = 0;
  await assert.rejects(listChatMessages({
    $queryRawUnsafe: async (sql, company, id) => {
      calls++;
      assert.equal(company, 'company');
      assert.equal(id, 'foreign');
      assert.match(sql, /company_id = \$1 AND id = \$2/);
      return [];
    },
  }, context, { afterId: 'foreign' }), /Chat cursor not found/);
  assert.equal(calls, 1);
});

test('requestedIds snapshots echo exact requested set and exclude soft deleted/foreign messages', async () => {
  const client = {
    $queryRaw: async () => [],
    async $queryRawUnsafe(sql, company, ids) {
      assert.equal(company, 'company');
      assert.deepEqual(ids, ['live', 'deleted', 'foreign']);
      assert.match(sql, /m\.company_id = \$1/);
      assert.match(sql, /m\.deleted_at IS NULL/);
      assert.match(sql, /m\.id = ANY\(\$2::text\[\]\)/);
      return [row('live')];
    },
  };
  const result = await listChatMessages(client, context, { messageIds: 'live,deleted,foreign,live' });
  assert.deepEqual(result.requestedIds, ['live', 'deleted', 'foreign']);
  assert.deepEqual(result.messages.map(item => item.id), ['live']);
  assert.equal(result.hasMore, false);
});

test('selector combinations, oversized snapshots and malformed cursors fail before querying', async () => {
  const forbidden = new Proxy({}, { get() { throw new Error('must not query'); } });
  for (const args of [
    { beforeId: 'a', afterId: 'b' },
    { before: '2026-01-01', beforeId: 'a' },
    { messageIds: 'a', afterId: 'b' },
    { messageIds: Array(101).fill('a') },
    { messageIds: '' }, { messageIds: 'a,,b' },
    { afterId: ' ' }, { afterId: 'x'.repeat(121) },
    { beforeId: ' ' }, { beforeId: 'x'.repeat(121) },
  ]) await assert.rejects(listChatMessages(forbidden, context, args), /chat cursors|chat message ids|chat cursor/);
});

test('legacy latest and beforeId history stay oldest-first within the requested page', async () => {
  const client = {
    $queryRaw: async () => [],
    $queryRawUnsafe: async (sql, company, cursorOrLimit) => {
      assert.equal(company, 'company');
      assert.match(sql, /ORDER BY m\.created_at DESC, m\.id DESC/);
      if (typeof cursorOrLimit === 'string') assert.equal(cursorOrLimit, 'cursor');
      return [row('2'), row('1')];
    },
  };
  for (const options of [{ limit: 2 }, { beforeId: 'cursor', limit: 2 }]) {
    const page = await listChatMessages(client, context, options);
    assert.deepEqual(page.messages.map(item => item.id), ['1', '2']);
    assert.equal(page.hasMore, true);
    assert.equal(page.requestedIds, undefined);
  }
});

test('concurrent same-client-id sends return one message and enqueue exactly once', async () => {
  let insertedRow;
  let selectCalls = 0;
  let queued = 0;
  const client = {
    $queryRawUnsafe: async (sql, company, id) => {
      assert.equal(company, 'company');
      return insertedRow?.id === id ? [insertedRow] : [];
    },
    $executeRaw: async () => { queued++; return 1; },
    async $queryRaw(parts, ...values) {
      const sql = parts.join('?');
      if (sql.includes('SELECT id FROM chat_messages')) {
        // Both requests reach the initial lookup before either inserts.
        selectCalls++;
        if (selectCalls <= 2) return [];
        return insertedRow ? [{ id: insertedRow.id }] : [];
      }
      if (sql.includes('INSERT INTO chat_messages')) {
        assert.match(sql, /ON CONFLICT \(author_membership_id, client_message_id\)/);
        if (insertedRow) return [];
        insertedRow = { ...row(values[0]), clientMessageId: 'stable', body: values[4] };
        return [{ id: values[0] }];
      }
      if (sql.includes('chat_notification_outbox')) { queued++; return []; }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const results = await Promise.all([
    createChatMessage(client, context, { body: 'Message', clientMessageId: 'stable' }),
    createChatMessage(client, context, { body: 'Message', clientMessageId: 'stable' }),
  ]);
  assert.equal(results[0].message.id, results[1].message.id);
  assert.equal(results.filter(result => result.duplicate).length, 1);
  assert.equal(queued, 1);
});

test('retry acknowledges original message even if its reply target was subsequently deleted', async () => {
  let queries = 0;
  const client = {
    $queryRaw: async (parts) => {
      queries++;
      assert.match(parts.join('?'), /SELECT id FROM chat_messages/);
      return [{ id: 'existing' }];
    },
    $queryRawUnsafe: async () => [row('existing')],
  };
  const result = await createChatMessage(client, context, {
    body: 'Old reply', clientMessageId: 'stable', replyToMessageId: 'deleted-target',
  });
  assert.equal(result.duplicate, true);
  assert.equal(queries, 1);
});

test('retry of a deleted message returns a redacted tombstone acknowledgement without enqueueing again', async () => {
  const deletedAt = new Date('2026-10-22T09:00:00.000Z');
  const client = {
    $queryRaw: async parts => {
      assert.match(parts.join('?'), /SELECT id FROM chat_messages/);
      return [{ id: 'deleted' }];
    },
    $queryRawUnsafe: async () => [{
      ...row('deleted'), body: 'Removed private text', clientMessageId: 'stable',
      deletedAt, replyToMessageId: 'target', replyBody: 'Removed reply text',
    }],
    $executeRaw: async () => { throw new Error('must not enqueue a duplicate'); },
  };
  const result = await createChatMessage(client, context, {
    body: 'Removed private text', clientMessageId: 'stable', replyToMessageId: 'target',
  });
  assert.equal(result.duplicate, true);
  assert.equal(result.message.id, 'deleted');
  assert.equal(result.message.clientMessageId, 'stable');
  assert.equal(result.message.deletedAt, deletedAt.toISOString());
  assert.equal(result.message.body, '');
  assert.equal(result.message.replyTo, null);
});
