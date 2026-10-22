import { randomUUID } from 'node:crypto';
import { notifyCompanyAboutChatMessage } from './chat-push.js';

export const CHAT_NOTIFICATION_MAX_ATTEMPTS = 8;
const LEASE_MS = 120_000;

/** Call only inside the transaction which inserts a new, nonduplicate message. */
export async function enqueueChatNotification(client, context, message) {
  const member = context?.activeMembership;
  if (!member?.id || !member?.companyId || !message?.id) {
    throw new Error('Chat notification requires a message and company');
  }
  await client.$executeRaw`
    INSERT INTO chat_notification_outbox (message_id, company_id, author_membership_id)
    VALUES (${message.id}, ${member.companyId}, ${member.id})
    ON CONFLICT (message_id) DO NOTHING
  `;
}

export function chatNotificationRetryDelay(attempt) {
  return Math.min(30 * 60_000, 5_000 * 2 ** Math.max(0, Number(attempt) - 1));
}

async function claimJob(client, leaseToken) {
  const rows = await client.$queryRaw`
    WITH exhausted AS (
      UPDATE chat_notification_outbox
         SET failed_at = CURRENT_TIMESTAMP, lease_token = NULL, lease_until = NULL,
             last_error = 'Retry limit reached after interrupted delivery'
       WHERE completed_at IS NULL AND failed_at IS NULL
         AND attempts >= ${CHAT_NOTIFICATION_MAX_ATTEMPTS}
         AND (lease_until IS NULL OR lease_until <= CURRENT_TIMESTAMP)
      RETURNING message_id
    ), candidate AS (
      SELECT message_id FROM chat_notification_outbox
       WHERE completed_at IS NULL AND failed_at IS NULL
         AND attempts < ${CHAT_NOTIFICATION_MAX_ATTEMPTS}
         AND available_at <= CURRENT_TIMESTAMP
         AND (lease_until IS NULL OR lease_until <= CURRENT_TIMESTAMP)
       ORDER BY available_at, created_at, message_id
       FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE chat_notification_outbox job
       SET attempts = job.attempts + 1, lease_token = ${leaseToken},
           lease_until = CURRENT_TIMESTAMP + (${LEASE_MS} * INTERVAL '1 millisecond')
      FROM candidate
     WHERE job.message_id = candidate.message_id
    RETURNING job.message_id AS "messageId", job.company_id AS "companyId",
              job.author_membership_id AS "authorMembershipId", job.attempts
  `;
  return rows[0] || null;
}

async function loadDelivery(client, job) {
  // Recheck soft deletion and sender access on every attempt, including retries.
  const rows = await client.$queryRaw`
    SELECT m.id, m.body, m.created_at AS "createdAt", u.name AS "authorName"
      FROM chat_messages m
      JOIN company_memberships cm ON cm.id = m.author_membership_id
      JOIN users u ON u.id = cm."userId"
     WHERE m.id = ${job.messageId} AND m.company_id = ${job.companyId}
       AND m.author_membership_id = ${job.authorMembershipId}
       AND cm."companyId" = ${job.companyId}
       AND m.deleted_at IS NULL AND cm.status = 'ACTIVE'
       AND cm."deletedAt" IS NULL AND u."deletedAt" IS NULL
     LIMIT 1
  `;
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    context: {
      activeMembership: { id: job.authorMembershipId, companyId: job.companyId },
      user: { name: row.authorName || 'WorkTrack' },
    },
    message: { id: row.id, body: row.body, createdAt: row.createdAt, author: { name: row.authorName || 'WorkTrack' } },
  };
}

async function settleJob(client, job, leaseToken, error, now) {
  if (!error) {
    await client.$executeRaw`
      UPDATE chat_notification_outbox
         SET completed_at = CURRENT_TIMESTAMP, lease_token = NULL, lease_until = NULL,
             last_error = NULL
       WHERE message_id = ${job.messageId} AND lease_token = ${leaseToken}
    `;
    return;
  }
  const availableAt = new Date(now() + chatNotificationRetryDelay(job.attempts));
  // Store a category only: database and transport messages can contain personal data.
  const category = String(error?.name || 'DeliveryError').slice(0, 80);
  await client.$executeRaw`
    UPDATE chat_notification_outbox
       SET available_at = ${availableAt},
           failed_at = CASE WHEN attempts >= ${CHAT_NOTIFICATION_MAX_ATTEMPTS}
                            THEN CURRENT_TIMESTAMP ELSE NULL END,
           lease_token = NULL, lease_until = NULL, last_error = ${category}
     WHERE message_id = ${job.messageId} AND lease_token = ${leaseToken}
  `;
}

/** Postgres is the durable queue; no process-local task is the source of truth. */
export function createChatNotificationWorker({
  client,
  deliver = notifyCompanyAboutChatMessage,
  now = Date.now,
  schedule = setInterval,
  cancel = clearInterval,
  makeLeaseToken = randomUUID,
  onError = () => console.warn('Chat notification worker will retry after a processing failure'),
  pollMs = 2_000,
} = {}) {
  let timer = null, running = null, stopped = false, lastCleanup = 0;
  async function drain() {
    for (let processed = 0; processed < 10 && !stopped; processed++) {
      const leaseToken = makeLeaseToken();
      const job = await claimJob(client, leaseToken);
      if (!job) break;
      // Renew long fan-outs; a crashed process loses the lease and another recovers it.
      const renew = schedule(() => {
        void client.$executeRaw`
          UPDATE chat_notification_outbox
             SET lease_until = CURRENT_TIMESTAMP + (${LEASE_MS} * INTERVAL '1 millisecond')
           WHERE message_id = ${job.messageId} AND lease_token = ${leaseToken}
        `.catch(onError);
      }, LEASE_MS / 3);
      renew?.unref?.();
      let failure = null;
      try {
        const delivery = await loadDelivery(client, job);
        if (delivery) await deliver(client, delivery.context, delivery.message, { durable: true });
      } catch (error) {
        failure = error;
      } finally {
        cancel(renew);
      }
      await settleJob(client, job, leaseToken, failure, now);
    }
    if (!stopped && now() - lastCleanup > 3_600_000) {
      await client.$executeRaw`
        DELETE FROM chat_notification_outbox
         WHERE completed_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
            OR failed_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
      `;
      lastCleanup = now();
    }
  }
  function tick() {
    if (stopped) return Promise.resolve();
    if (running) return running;
    running = drain().catch(onError).finally(() => { running = null; });
    return running;
  }
  return {
    tick,
    start() {
      if (timer || stopped) return;
      timer = schedule(() => { void tick(); }, pollMs);
      timer?.unref?.();
      void tick();
    },
    async stop() {
      stopped = true;
      if (timer) cancel(timer);
      timer = null;
      await running;
    },
  };
}
