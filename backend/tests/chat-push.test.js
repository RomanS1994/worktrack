import assert from 'node:assert/strict';
import test from 'node:test';

import { notifyCompanyAboutChatMessage } from '../services/chat-push.js';

function createClient() {
  const created = [];
  return {
    created,
    $queryRaw: async (...args) => {
      assert.equal(args[1], 'room-1');
      assert.equal(args[2], 'member-a');
      return [{ id: 'member-b' }, { id: 'member-c' }];
    },
    companyMembership: {
      async findMany() {
        return [{ id: 'member-b' }, { id: 'member-c' }];
      },
      async findUnique({ where }) {
        return {
          id: where.id,
          companyId: 'company-1',
          user: { profile: {} },
        };
      },
    },
    notification: {
      async create({ data }) {
        const item = {
          ...data,
          href: data.href || null,
          readAt: null,
          createdAt: new Date('2026-09-06T08:00:00.000Z'),
        };
        created.push(item);
        return item;
      },
    },
  };
}

test('chat message creates a notification for every active recipient', async () => {
  const client = createClient();
  const context = {
    activeMembership: { id: 'member-a', companyId: 'company-1' },
    user: { name: 'Roman' },
  };

  await notifyCompanyAboutChatMessage(client, context, {
    id: 'message-1',
    roomId: 'room-1',
    body: 'Hello team',
    author: { name: 'Roman Stryzhka' },
  });

  assert.equal(client.created.length, 2);
  assert.deepEqual(
    client.created.map(item => ({
      recipientMembershipId: item.recipientMembershipId,
      type: item.type,
      title: item.title,
      message: item.message,
      href: item.href,
    })),
    [
      {
        recipientMembershipId: 'member-b',
        type: 'chat.message',
        title: 'Roman Stryzhka',
        message: 'Hello team',
        href: '/chat?roomId=room-1&messageId=message-1',
      },
      {
        recipientMembershipId: 'member-c',
        type: 'chat.message',
        title: 'Roman Stryzhka',
        message: 'Hello team',
        href: '/chat?roomId=room-1&messageId=message-1',
      },
    ],
  );
});

test('chat message never notifies the sender membership', async () => {
  const client = createClient();
  let query;
  client.$queryRaw = async (...args) => {
    query = args;
    return [];
  };
  client.companyMembership.findMany = async args => {
    return [];
  };

  await notifyCompanyAboutChatMessage(client, {
    activeMembership: { id: 'sender-1', companyId: 'company-1' },
  }, {
    id: 'message-2',
    roomId: 'room-1',
    body: 'Test',
  });

  assert.equal(query[2], 'sender-1');
  assert.equal(client.created.length, 0);
});
