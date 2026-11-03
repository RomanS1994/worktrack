import assert from 'node:assert/strict';
import test from 'node:test';
import { createECDH, randomBytes } from 'node:crypto';
import {
  CHAT_NOTIFICATION_MAX_ATTEMPTS,
  chatNotificationRetryDelay,
  createChatNotificationWorker,
  enqueueChatNotification,
} from '../services/chat-notification-outbox.js';
import { notifyCompanyAboutChatMessage } from '../services/chat-push.js';
import { createNotification } from '../services/notifications.js';

const job = (attempts = 1) => ({ messageId: 'message-1', companyId: 'company-1', authorMembershipId: 'sender', attempts });
const sql = (parts) => parts.join('?');
const delivery = { id: 'message-1', body: 'Meet at the site', createdAt: new Date('2026-10-22T08:00:00Z'), authorName: 'Roman' };
function clientFor(jobs, { message = delivery } = {}) {
  const writes = [], claims = [];
  return {
    writes, claims,
    async $queryRaw(parts, ...values) {
      const query = sql(parts);
      if (query.includes('WITH exhausted')) {
        claims.push(values);
        return jobs.length ? [jobs.shift()] : [];
      }
      if (query.includes('SELECT m.id')) return message ? [message] : [];
      throw new Error('Unexpected query');
    },
    async $executeRaw(parts, ...values) {
      writes.push({ query: sql(parts), values });
      return 1;
    },
  };
}
function workerFor(client, options = {}) {
  const intervals = new Set();
  return {
    intervals,
    worker: createChatNotificationWorker({
      client,
      makeLeaseToken: () => 'lease-owned-by-this-worker',
      now: () => Date.parse('2026-10-22T09:00:00Z'),
      schedule: (fn) => { intervals.add(fn); return fn; },
      cancel: (fn) => intervals.delete(fn),
      onError: (error) => { throw error; },
      ...options,
    }),
  };
}

test('enqueue binds the source company, sender and message and rejects incomplete identity', async () => {
  const client = clientFor([]);
  await enqueueChatNotification(client, { activeMembership: { id: 'sender', companyId: 'company-1' } }, { id: 'message-1' });
  assert.deepEqual(client.writes[0].values, ['message-1', 'company-1', 'sender']);
  await assert.rejects(enqueueChatNotification(client, {}, { id: 'message-1' }), /requires a message and company/);
});

test('overlapping worker ticks join one delivery, renew its lease and stop cleanly', async () => {
  const client = clientFor([job()]);
  let release, deliveries = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const { worker, intervals } = workerFor(client, { deliver: async () => { deliveries++; await gate; } });
  const first = worker.tick();
  await new Promise(resolve => setImmediate(resolve));
  const second = worker.tick();
  assert.equal(first, second);
  assert.equal(deliveries, 1);
  assert.equal(intervals.size, 1);
  release();
  await first;
  assert.equal(intervals.size, 0);
  const completion = client.writes.find(write => write.query.includes('SET completed_at'));
  assert.deepEqual(completion.values, ['message-1', 'lease-owned-by-this-worker']);
  await worker.stop();
  const claimCount = client.claims.length;
  await worker.tick();
  assert.equal(client.claims.length, claimCount);
});

test('deleted messages or revoked senders cancel queued delivery without notifying anyone', async () => {
  const client = clientFor([job()], { message: null });
  const { worker } = workerFor(client, { deliver: () => assert.fail('Revoked message must not deliver') });
  await worker.tick();
  assert.ok(client.writes.some(write => write.query.includes('SET completed_at')));
});

test('failure reschedules the durable job with a bounded delay and stores no message text', async () => {
  const client = clientFor([job(3)]);
  const { worker } = workerFor(client, { deliver: async () => { throw new Error('private endpoint and payload'); } });
  await worker.tick();
  const retry = client.writes.find(write => write.query.includes('SET available_at'));
  assert.equal(retry.values[0].toISOString(), '2026-10-22T09:00:20.000Z');
  assert.equal(retry.values[1], CHAT_NOTIFICATION_MAX_ATTEMPTS);
  assert.equal(retry.values[2], 'Error');
  assert.equal(JSON.stringify(retry.values).includes('private'), false);
  assert.equal(chatNotificationRetryDelay(20), 30 * 60_000);
});

test('failure to settle a successful delivery leaves the durable lease recoverable', async () => {
  const client = clientFor([job()]);
  const original = client.$executeRaw;
  client.$executeRaw = async (...args) => {
    if (sql(args[0]).includes('SET completed_at')) throw new Error('Database unavailable');
    return original(...args);
  };
  const failures = [];
  const { worker, intervals } = workerFor(client, { deliver: async () => {}, onError: error => failures.push(error) });
  await worker.tick();
  assert.equal(failures.length, 1);
  assert.equal(intervals.size, 0);
  assert.equal(client.writes.some(write => write.query.includes('SET completed_at')), false);
});

test('partial fan-out retries reuse notification IDs and preserve already-read records', async () => {
  const records = new Map();
  let failRecipient = true, capturedWhere;
  const client = {
    companyMembership: {
      findMany: async ({ where }) => { capturedWhere = where; return [{ id: 'a' }, { id: 'b' }]; },
      findFirst: async () => ({ id: 'active-recipient' }),
      findUnique: async ({ where }) => ({ id: where.id, companyId: 'company-1', user: { profile: {} } }),
    },
    notification: {
      async upsert({ where, create }) {
        if (create.recipientMembershipId === 'b' && failRecipient) { failRecipient = false; throw new Error('Try again'); }
        if (!records.has(where.id)) records.set(where.id, { ...create });
        return records.get(where.id);
      },
    },
  };
  const context = { activeMembership: { id: 'sender', companyId: 'company-1' } };
  const message = { ...delivery, author: { name: 'Roman' } };
  await assert.rejects(notifyCompanyAboutChatMessage(client, context, message, { durable: true }), /Try again/);
  assert.equal(records.size, 1);
  const first = [...records.values()][0];
  first.readAt = new Date('2026-10-22T08:01:00Z');
  await notifyCompanyAboutChatMessage(client, context, message, { durable: true });
  assert.equal(records.size, 2);
  assert.equal(records.get(first.id).readAt.toISOString(), '2026-10-22T08:01:00.000Z');
  assert.equal(capturedWhere.createdAt.lte.toISOString(), delivery.createdAt.toISOString());
  assert.equal(capturedWhere.id.not, 'sender');
});

test('durable Web Push failure requests retry while existing notifications keep legacy behavior', async () => {
  const originalFetch = globalThis.fetch, originalSecret = process.env.AUTH_TOKEN_SECRET;
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const subscription = {
    endpoint: 'https://push.invalid/subscription',
    membershipId: 'recipient', companyId: 'company-1',
    keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') },
  };
  const records = new Map();
  const client = {
    companyMembership: {
      findFirst: async () => ({ id: 'recipient' }),
      findUnique: async () => ({ id: 'recipient', companyId: 'company-1', user: { profile: { pushSubscriptions: [subscription] } } }),
    },
    notification: {
      upsert: async ({ where, create }) => { if (!records.has(where.id)) records.set(where.id, { ...create, createdAt: new Date('2026-10-22T08:00:00Z') }); return records.get(where.id); },
    },
  };
  try {
    process.env.AUTH_TOKEN_SECRET = 'test-only-chat-outbox-push-secret';
    globalThis.fetch = async (_url, options) => {
      assert.ok(options.signal);
      return { ok: false, status: 503 };
    };
    const payload = { companyId: 'company-1', recipientMembershipId: 'recipient', deduplicationKey: 'stable-message-recipient', retryPush: true };
    await assert.rejects(createNotification(client, payload), /requires retry/);
    globalThis.fetch = async () => ({ ok: true, status: 201 });
    await createNotification(client, payload);
    assert.equal(records.size, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.AUTH_TOKEN_SECRET;
    else process.env.AUTH_TOKEN_SECRET = originalSecret;
  }
});
