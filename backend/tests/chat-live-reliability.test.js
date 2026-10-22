import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { createChatLiveService } from '../services/chat-live.js';
import { hasChatStreamAccess } from '../services/chat-access.js';
import { createChatMutationLimiter } from '../services/chat-limits.js';
import { resolveErrorStatus } from '../lib/errors.js';

function fixture(options = {}) {
  let current = Date.parse('2026-10-22T08:00:00Z');
  let nextId = 0;
  const intervals = new Map(), timeouts = new Map();
  const live = createChatLiveService({
    now: () => current,
    setInterval: fn => { const id = ++nextId; intervals.set(id, fn); return id; },
    clearInterval: id => intervals.delete(id),
    setTimeout: (fn, delay) => { const id = ++nextId; timeouts.set(id, { fn, at: current + delay }); return id; },
    clearTimeout: id => timeouts.delete(id),
    ...options,
  });
  function connection(company = 'company', member = 'member', authorize = async () => true) {
    const request = new EventEmitter(), response = new EventEmitter();
    Object.assign(response, {
      data: [], writableLength: 0, writableEnded: false, destroyed: false,
      writeHead(code, headers) { this.code = code; this.headers = headers; },
      write(value) { this.data.push(value); return !this.blocked; },
      end() { this.writableEnded = true; this.emit('close'); },
    });
    const close = live.subscribe(request, response, company, member, {
      authorize, expiresAt: new Date(current + 60000),
    });
    return { request, response, close };
  }
  async function tick(ms = 0) {
    current += ms;
    for (const [id, timer] of [...timeouts])
      if (timer.at <= current) { timeouts.delete(id); timer.fn(); }
    await Promise.resolve(); await Promise.resolve();
  }
  async function heartbeat() {
    for (const fn of [...intervals.values()]) fn();
    await Promise.resolve(); await Promise.resolve();
  }
  return { live, connection, tick, heartbeat, intervals, timeouts };
}

test('streams and presence stay company scoped and multiple devices count as one member', () => {
  const { live, connection } = fixture();
  const a = connection(), b = connection(), c = connection('other');
  assert.equal(live.connectionCount(), 3);
  assert.equal(live.presence('company').onlineCount, 1);
  live.broadcast('company', 'message', { id: 'private' });
  assert.ok(a.response.data.at(-1).includes('private'));
  assert.ok(b.response.data.at(-1).includes('private'));
  assert.ok(c.response.data.every(frame => !frame.includes('private')));
  a.close(); b.close(); c.close();
  assert.equal(live.connectionCount(), 0);
});

test('revocation recheck closes the stream and releases timers/listeners', async () => {
  const f = fixture();
  let allowed = true;
  const c = f.connection('company', 'member', async () => allowed);
  await f.heartbeat();
  assert.ok(c.response.data.at(-1).startsWith(': ping'));
  allowed = false;
  await f.heartbeat();
  assert.equal(c.response.writableEnded, true);
  assert.equal(f.live.connectionCount(), 0);
  assert.equal(f.intervals.size, 0);
  assert.equal(f.timeouts.size, 0);
  assert.equal(c.request.listenerCount('close'), 0);
  const length = c.response.data.length;
  f.live.broadcast('company', 'message', { id: 'secret' });
  assert.equal(c.response.data.length, length);
});

test('exact access expiry closes without waiting for the next heartbeat', async () => {
  const f = fixture();
  const c = f.connection();
  await f.tick(60000);
  assert.equal(c.response.writableEnded, true);
  assert.equal(f.live.connectionCount(), 0);
});

test('failed authorization and a stalled authorization both fail closed', async () => {
  const failed = fixture();
  const a = failed.connection('company', 'member', async () => { throw new Error('DB unavailable'); });
  await failed.heartbeat();
  assert.equal(a.response.writableEnded, true);
  const stalled = fixture();
  let resolve;
  const b = stalled.connection('company', 'member', () => new Promise(r => { resolve = r; }));
  await stalled.heartbeat();
  await stalled.tick(5000);
  assert.equal(b.response.writableEnded, true);
  const length = b.response.data.length;
  resolve(true);
  await Promise.resolve();
  assert.equal(b.response.data.length, length);
  assert.equal(stalled.timeouts.size, 0);
});

test('slow or closed clients are removed instead of buffering unlimited events', () => {
  const f = fixture();
  const a = f.connection();
  a.response.blocked = true;
  f.live.broadcast('company', 'message', { id: 'x' });
  assert.equal(a.response.writableEnded, true);
  assert.equal(f.live.connectionCount(), 0);
  const b = f.connection();
  b.response.writableLength = 300000;
  f.live.broadcast('company', 'message', { id: 'y' });
  assert.equal(b.response.writableEnded, true);
  assert.equal(f.live.connectionCount(), 0);
});

test('connection bounds reject before headers and normal disconnect permits reconnect', () => {
  const f = fixture({ maxPerMember: 1, maxConnections: 2 });
  const a = f.connection();
  assert.throws(() => f.connection(), /Too many chat connections/);
  const b = f.connection('other');
  assert.throws(() => f.connection('third'), /Too many chat connections/);
  a.request.emit('close');
  const c = f.connection();
  c.close(); b.close();
  assert.equal(f.live.connectionCount(), 0);
});

test('stream authorization requires active company membership and original session/user', async () => {
  const now = Date.parse('2026-10-22T08:00:00Z');
  const identity = { sessionId: 'session', userId: 'user', membershipId: 'member', companyId: 'company',
    expiresAt: new Date(now + 60000) };
  let session = { userId: 'user', expiresAt: new Date(now + 120000), user: { deletedAt: null } };
  let active = true;
  const client = {
    session: { findUnique: async args => { assert.equal(args.where.id, 'session'); return session; } },
    companyMembership: { findFirst: async ({ where }) => {
      assert.deepEqual(where, { id: 'member', companyId: 'company', userId: 'user', status: 'ACTIVE', deletedAt: null });
      return active ? { id: 'member' } : null;
    } },
  };
  assert.equal(await hasChatStreamAccess(client, identity, now), true);
  active = false;
  assert.equal(await hasChatStreamAccess(client, identity, now), false);
  active = true; session.user.deletedAt = new Date();
  assert.equal(await hasChatStreamAccess(client, identity, now), false);
  session = null;
  assert.equal(await hasChatStreamAccess(client, identity, now), false);
  assert.equal(await hasChatStreamAccess(client, { ...identity, expiresAt: 'bad' }, now), false);
  assert.equal(await hasChatStreamAccess(client, identity, now + 60000), false);
});

test('mutation limits isolate users, companies and actions and refill predictably', () => {
  let now = 0;
  const consume = createChatMutationLimiter({ now: () => now });
  for (let i = 0; i < 30; i++) consume('a', 'one', 'message');
  assert.throws(() => consume('a', 'one', 'message'), /rate limit/);
  consume('a', 'two', 'message');
  consume('b', 'one', 'message');
  consume('a', 'one', 'reaction');
  now += 1000;
  consume('a', 'one', 'message');
  assert.throws(() => consume('a', 'one', 'message'), /rate limit/);
  now += 60000;
  consume('a', 'one', 'message');
});

test('limiter key count is bounded without discarding active user rate budgets', () => {
  let now = 0;
  const consume = createChatMutationLimiter({ now: () => now, maxKeys: 1 });
  consume('a', 'one', 'message');
  assert.throws(() => consume('a', 'two', 'message'), /rate limit/);
  now = 60000;
  consume('a', 'two', 'message');
});

test('chat errors expose actionable client statuses instead of generic server errors', () => {
  for (const message of ['Invalid chat cursor', 'Conflicting chat cursors', 'Invalid chat message ids'])
    assert.equal(resolveErrorStatus(new Error(message)), 400);
  assert.equal(resolveErrorStatus(new Error('Chat cursor not found')), 404);
  assert.equal(resolveErrorStatus(new Error('Chat rate limit exceeded')), 429);
  assert.equal(resolveErrorStatus(new Error('Too many chat connections')), 429);
});
