import assert from 'node:assert/strict';
import test from 'node:test';

import { markChatRead } from '../services/company-chat.js';

function context() {
  return {
    activeMembership: {
      id: 'member-1',
      companyId: 'company-1',
      status: 'ACTIVE',
    },
  };
}

function taggedValues(args) {
  return args.slice(1);
}

test('mark chat read resolves read time from a message in the active company', async () => {
  const messageAt = new Date('2026-09-06T08:15:00.000Z');
  let writtenValues = null;
  const client = {
    $queryRaw: async (...args) => {
      const values = taggedValues(args);
      assert.equal(values[0], 'message-1');
      assert.equal(values[1], 'company-1');
      return [{ createdAt: messageAt }];
    },
    $executeRaw: async (...args) => {
      writtenValues = taggedValues(args);
      return 1;
    },
  };

  const result = await markChatRead(client, context(), { messageId: 'message-1' });

  assert.equal(result.lastReadAt, messageAt.toISOString());
  assert.equal(writtenValues[0], 'member-1');
  assert.equal(writtenValues[1], 'company-1');
  assert.equal(new Date(writtenValues[2]).toISOString(), messageAt.toISOString());
});

test('mark chat read rejects a message outside the active company', async () => {
  let writes = 0;
  const client = {
    $queryRaw: async () => [],
    $executeRaw: async () => {
      writes += 1;
      return 1;
    },
  };

  await assert.rejects(
    markChatRead(client, context(), { messageId: 'other-company-message' }),
    /Chat message not found/,
  );
  assert.equal(writes, 0);
});

test('legacy read timestamp is clamped to the latest real message', async () => {
  const latestAt = new Date('2026-09-06T09:00:00.000Z');
  let writtenAt = null;
  const client = {
    $queryRaw: async () => [{ createdAt: latestAt }],
    $executeRaw: async (...args) => {
      writtenAt = taggedValues(args)[2];
      return 1;
    },
  };

  const result = await markChatRead(client, context(), { readAt: '2099-01-01T00:00:00.000Z' });

  assert.equal(result.lastReadAt, latestAt.toISOString());
  assert.equal(new Date(writtenAt).toISOString(), latestAt.toISOString());
});
