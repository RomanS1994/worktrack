import assert from 'node:assert/strict';
import test from 'node:test';

import { createChatRoom, listChatRooms } from '../services/chat-rooms.js';

function context(role = 'EMPLOYEE') {
  return {
    activeMembership: {
      id: 'membership-1',
      companyId: 'company-1',
      role,
      status: 'ACTIVE',
    },
  };
}

test('only a manager can create a chat room', async () => {
  let databaseCalls = 0;
  const client = {
    companyMembership: { findMany: async () => { databaseCalls += 1; return []; } },
    $executeRaw: async () => { databaseCalls += 1; },
    $queryRaw: async () => { databaseCalls += 1; return []; },
  };

  await assert.rejects(
    createChatRoom(client, context('EMPLOYEE'), { name: 'Об’єкт Бероун', memberIds: [] }),
    /Manager access is required/,
  );
  assert.equal(databaseCalls, 0);
});

test('chat room listing is restricted to rooms joined by the active membership and company', async () => {
  let query;
  const client = {
    $queryRaw: async (strings, ...values) => {
      query = { sql: strings.join('?'), values };
      return [];
    },
  };

  const result = await listChatRooms(client, context());

  assert.deepEqual(result, { rooms: [] });
  assert.match(query.sql, /JOIN chat_room_members/);
  assert.match(query.sql, /rm\.membership_id = \?/);
  assert.match(query.sql, /rm\.left_at IS NULL/);
  assert.match(query.sql, /WHERE r\.company_id = \?/);
  assert.deepEqual(query.values, ['membership-1', 'company-1']);
});
