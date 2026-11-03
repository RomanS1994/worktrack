import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNativeChatPush,
  processNativePushDeliveries,
  saveNativePushRegistration,
  validateNativePushRegistration,
} from '../services/native-push.js';

const PROJECT_ID = 'f2fb43b7-36ae-450a-8d34-cbdeb5bf7d58';
const TOKEN = 'ExponentPushToken[abcDEF1234567890]';
const sql = parts => parts.join('?');

function deliveryClient({ resultJob = true, item = {} } = {}) {
  const calls = [];
  let claimCount = 0;
  return {
    calls,
    async $queryRaw(parts) {
      const query = sql(parts);
      if (query.includes('WITH exhausted AS')) {
        claimCount++;
        return resultJob && claimCount === 1 ? [{
          notificationId: 'notification-1',
          registrationId: 'registration-1',
          messageId: 'message-1',
          ticketId: null,
          ticketAt: null,
          attempts: 1,
        }] : [];
      }
      if (query.includes('SELECT r.token')) return [
        {
          token: TOKEN,
          projectId: PROJECT_ID,
          companyId: 'company-1',
          membershipId: 'membership-1',
          registrationUpdatedAt: new Date('2026-10-22T09:00:00Z'),
          language: 'uk',
          sound: true,
          preview: true,
          title: 'Roman',
          body: 'Meet at the site',
          notificationId: 'notification-1',
          messageId: 'message-1',
          ...item,
        },
      ];
      throw new Error(`Unexpected query: ${query}`);
    },
    async $executeRaw(parts, ...values) {
      calls.push({ query: sql(parts), values });
      return 1;
    },
  };
}

test('native push registration validates device, project and token and normalizes options', () => {
  const original = process.env.EXPO_PUSH_PROJECT_IDS;
  delete process.env.EXPO_PUSH_PROJECT_IDS;
  try {
    assert.deepEqual(validateNativePushRegistration({
      token: TOKEN,
      projectId: PROJECT_ID,
      installationId: 'ios-installation-01',
      platform: 'ios',
      language: 'CS',
      sound: false,
      preview: false,
    }), {
      token: TOKEN,
      projectId: PROJECT_ID,
      installationId: 'ios-installation-01',
      platform: 'ios',
      language: 'uk',
      sound: false,
      preview: false,
    });
    for (const invalid of [
      { token: 'https://attacker.invalid', projectId: PROJECT_ID, installationId: 'ios-installation-01', platform: 'ios' },
      { token: TOKEN, projectId: 'not-a-project-id', installationId: 'ios-installation-01', platform: 'ios' },
      { token: TOKEN, projectId: PROJECT_ID, installationId: 'short', platform: 'ios' },
      { token: TOKEN, projectId: PROJECT_ID, installationId: 'ios-installation-01', platform: 'web' },
      { token: TOKEN, projectId: PROJECT_ID, installationId: 'ios-installation-01', platform: 'ios', sound: 'false' },
    ]) assert.throws(() => validateNativePushRegistration(invalid), /Invalid native push registration/);

    process.env.EXPO_PUSH_PROJECT_IDS = '00000000-0000-0000-0000-000000000001';
    assert.throws(() => validateNativePushRegistration({
      token: TOKEN, projectId: PROJECT_ID, installationId: 'ios-installation-01', platform: 'ios',
    }), /Invalid native push registration/);
  } finally {
    if (original === undefined) delete process.env.EXPO_PUSH_PROJECT_IDS;
    else process.env.EXPO_PUSH_PROJECT_IDS = original;
  }
});

test('native registration is stored only for the live authenticated account scope', async () => {
  const calls = [];
  const client = {
    async $queryRaw(parts, ...values) {
      const query = sql(parts);
      calls.push({ method: 'query', query, values });
      if (query.includes('INSERT INTO native_push_registrations')) return [{ id: 'registration-1' }];
      return [];
    },
    async $executeRaw(parts, ...values) {
      calls.push({ method: 'execute', query: sql(parts), values });
      return 1;
    },
  };
  const context = {
    user: { id: 'user-1', deletedAt: null },
    activeMembership: {
      id: 'membership-1', userId: 'user-1', companyId: 'company-1', status: 'ACTIVE', deletedAt: null,
    },
    session: { id: 'session-1', userId: 'user-1', expiresAt: new Date(Date.now() + 60_000) },
  };
  const result = await saveNativePushRegistration(client, context, {
    token: TOKEN,
    projectId: PROJECT_ID,
    installationId: 'ios-installation-02',
    platform: 'ios',
    language: 'en',
  });
  assert.deepEqual(result, { ok: true, enabled: true, sound: true, preview: true });
  const insert = calls.find(call => call.query.includes('INSERT INTO native_push_registrations'));
  assert.ok(insert);
  assert.deepEqual(insert.values.slice(1, 8), [
    TOKEN, 'ios-installation-02', PROJECT_ID, 'user-1', 'membership-1', 'company-1', 'session-1',
  ]);
  assert.equal(JSON.stringify(result).includes(TOKEN), false);

  const rejectedCalls = [];
  const rejectingClient = {
    $queryRaw: async (...args) => { rejectedCalls.push(args); return []; },
    $executeRaw: async (...args) => { rejectedCalls.push(args); return 1; },
  };
  await assert.rejects(saveNativePushRegistration(rejectingClient, {
    ...context,
    session: { ...context.session, expiresAt: new Date(Date.now() - 60_000) },
  }, { token: TOKEN, projectId: PROJECT_ID, installationId: 'ios-installation-02', platform: 'ios' }), /Native push access is required/);
  assert.equal(rejectedCalls.length, 0);
});

test('native chat push carries the exact chat target and respects preview settings', () => {
  const payload = buildNativeChatPush({
    token: TOKEN,
    title: 'Roman',
    body: 'Meet at the site',
    language: 'uk',
    sound: true,
    preview: false,
    companyId: 'company-1',
    membershipId: 'membership-1',
    notificationId: 'notification-1',
    messageId: 'message-1',
  });
  assert.equal(payload.to, TOKEN);
  assert.equal(payload.title, 'WorkTrack');
  assert.equal(payload.body, 'Нове повідомлення в чаті компанії');
  assert.equal(payload.data.type, 'chat.message');
  assert.equal(payload.data.companyId, 'company-1');
  assert.equal(payload.data.membershipId, 'membership-1');
  assert.equal(payload.data.messageId, 'message-1');
  assert.equal(payload.data.notificationId, 'notification-1');
  assert.equal('recipientMembershipId' in payload.data, false);
  assert.equal(payload.channelId, 'worktrack-chat');
});

test('Expo accepted ticket is stored for receipt polling', async () => {
  const client = deliveryClient();
  const requests = [];
  await processNativePushDeliveries(client, {
    now: () => Date.parse('2026-10-22T09:00:00Z'),
    makeLeaseToken: () => 'lease-1',
    request: async (operation, body) => {
      requests.push({ operation, body });
      return [{ status: 'ok', id: 'expo-ticket-1' }];
    },
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].operation, 'send');
  assert.equal(requests[0].body.data.messageId, 'message-1');
  const settle = client.calls.find(call => call.query.includes('UPDATE native_push_deliveries SET status'));
  assert.ok(settle);
  assert.equal(settle.values[0], 'ticketed');
  assert.equal(settle.values[3], 'expo-ticket-1');
});

test('transient Expo send failure queues a bounded retry without exposing details', async () => {
  const client = deliveryClient();
  const requestError = new Error('Expo host and private payload');
  requestError.code = 'ExpoNetworkError';
  await processNativePushDeliveries(client, {
    now: () => Date.parse('2026-10-22T09:00:00Z'),
    makeLeaseToken: () => 'lease-2',
    request: async () => { throw requestError; },
  });
  const settle = client.calls.find(call => call.query.includes('UPDATE native_push_deliveries SET status'));
  assert.ok(settle);
  assert.equal(settle.values[0], 'queued');
  assert.equal(settle.values[1], 'ExpoNetworkError');
  assert.equal(JSON.stringify(client.calls).includes('private payload'), false);
});

test('DeviceNotRegistered removes only the stale registration and fails that delivery', async () => {
  const client = deliveryClient();
  await processNativePushDeliveries(client, {
    now: () => Date.parse('2026-10-22T09:00:00Z'),
    makeLeaseToken: () => 'lease-3',
    request: async () => [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
  });
  const remove = client.calls.find(call => call.query.includes('DELETE FROM native_push_registrations'));
  assert.ok(remove);
  assert.deepEqual(remove.values, ['registration-1', new Date('2026-10-22T09:00:00Z')]);
  const settle = client.calls.find(call => call.query.includes('UPDATE native_push_deliveries SET status'));
  assert.ok(settle);
  assert.equal(settle.values[0], 'failed');
  assert.equal(settle.values[1], 'DeviceNotRegistered');
});
