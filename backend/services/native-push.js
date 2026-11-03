import { randomUUID } from 'node:crypto';

// Official Expo Push Service HTTP API. No caller-controlled URLs or redirects.
// https://docs.expo.dev/push-notifications/sending-notifications/
const EXPO_SEND = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS = 'https://exp.host/--/api/v2/push/getReceipts';
const DEFAULT_PROJECT = 'f2fb43b7-36ae-450a-8d34-cbdeb5bf7d58';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^(?:ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/;
const INSTALLATION = /^[A-Za-z0-9._:-]{16,160}$/;
const RECEIPT_ID = /^[A-Za-z0-9._:-]{1,256}$/;
const MAX_ATTEMPTS = 8;
const LEASE_MS = 120_000;
const RECEIPT_DELAY = 15 * 60_000;
const RETRYABLE_CODES = new Set(['MessageRateExceeded', 'ExpoUnavailable', 'ExpoMalformedResponse', 'ExpoNetworkError']);

function error(message) { throw new Error(message); }
function projectAllowed(projectId) {
  return String(process.env.EXPO_PUSH_PROJECT_IDS || DEFAULT_PROJECT).split(',')
    .map(value => value.trim().toLowerCase()).filter(Boolean).includes(projectId);
}
function owner(context, now = Date.now()) {
  const user = context?.user, membership = context?.activeMembership, session = context?.session;
  if (!user?.id || user.deletedAt || !membership?.id || membership.status !== 'ACTIVE' ||
    membership.deletedAt || !membership.companyId || membership.userId !== user.id ||
    !session?.id || session.userId !== user.id || new Date(session.expiresAt).getTime() <= now ||
    !Number.isFinite(new Date(session.expiresAt).getTime())) error('Native push access is required');
  return { userId: user.id, membershipId: membership.id, companyId: membership.companyId, sessionId: session.id };
}

export function validateNativePushRegistration(body = {}) {
  const token = String(body.token || ''), projectId = String(body.projectId || '').toLowerCase();
  const installationId = String(body.installationId || '');
  if (!TOKEN.test(token) || !INSTALLATION.test(installationId) || !['ios', 'android'].includes(body.platform) ||
    !UUID.test(projectId) || !projectAllowed(projectId) ||
    (body.sound !== undefined && typeof body.sound !== 'boolean') ||
    (body.preview !== undefined && typeof body.preview !== 'boolean')) error('Invalid native push registration');
  return { token, projectId, installationId, platform: body.platform,
    language: ['uk', 'cs', 'en'].includes(body.language) ? body.language : 'uk',
    sound: body.sound !== false, preview: body.preview !== false };
}

/** Must run in runStoreTransaction. Installation ownership changes invalidate old jobs. */
export async function saveNativePushRegistration(client, context, body) {
  const scope = owner(context), value = validateNativePushRegistration(body);
  // Registration is infrequent. Serialize reassignment to prevent device/account races.
  await client.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('worktrack:native-push:registration:v1', 0))`;
  await client.$executeRaw`
    DELETE FROM native_push_registrations
     WHERE (token = ${value.token} OR (project_id = ${value.projectId} AND installation_id = ${value.installationId}))
       AND NOT (token = ${value.token} AND project_id = ${value.projectId} AND installation_id = ${value.installationId}
                AND user_id = ${scope.userId} AND membership_id = ${scope.membershipId}
                AND company_id = ${scope.companyId} AND session_id = ${scope.sessionId})
  `;
  const rows = await client.$queryRaw`
    INSERT INTO native_push_registrations
      (id, token, installation_id, project_id, user_id, membership_id, company_id, session_id, platform, language, sound, preview)
    SELECT ${randomUUID()}, ${value.token}, ${value.installationId}, ${value.projectId},
           ${scope.userId}, ${scope.membershipId}, ${scope.companyId}, ${scope.sessionId},
           ${value.platform}, ${value.language}, ${value.sound}, ${value.preview}
      FROM sessions s JOIN users u ON u.id = s."userId"
      JOIN company_memberships cm ON cm."userId" = u.id
     WHERE s.id = ${scope.sessionId} AND s."userId" = ${scope.userId} AND s."expiresAt" > CURRENT_TIMESTAMP
       AND u."deletedAt" IS NULL AND cm.id = ${scope.membershipId} AND cm."companyId" = ${scope.companyId}
       AND cm.status = 'ACTIVE' AND cm."deletedAt" IS NULL
    ON CONFLICT (token) DO UPDATE SET language = EXCLUDED.language, platform = EXCLUDED.platform,
      sound = EXCLUDED.sound, preview = EXCLUDED.preview, updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `;
  if (!rows.length) error('Native push access is required');
  await client.$executeRaw`
    DELETE FROM native_push_registrations WHERE user_id = ${scope.userId} AND id NOT IN (
      SELECT id FROM native_push_registrations WHERE user_id = ${scope.userId}
       ORDER BY updated_at DESC, id DESC LIMIT 20
    )
  `;
  return { ok: true, enabled: true, sound: value.sound, preview: value.preview };
}

export async function deleteNativePushRegistration(client, context, body = {}) {
  const scope = owner(context);
  if (!TOKEN.test(String(body.token || ''))) error('Invalid native push registration');
  // Never let a delayed logout unregister a token already reassigned to another session.
  await client.$executeRaw`
    DELETE FROM native_push_registrations
     WHERE token = ${body.token} AND session_id = ${scope.sessionId} AND user_id = ${scope.userId}
       AND membership_id = ${scope.membershipId} AND company_id = ${scope.companyId}
  `;
  return { ok: true, enabled: false };
}

export async function getNativePushSettings(client, context) {
  const scope = owner(context);
  const rows = await client.$queryRaw`
    SELECT sound, preview FROM native_push_registrations
     WHERE session_id = ${scope.sessionId} AND user_id = ${scope.userId}
       AND membership_id = ${scope.membershipId} AND company_id = ${scope.companyId}
     ORDER BY updated_at DESC LIMIT 20
  `;
  return { enabled: rows.length > 0, subscriptionCount: rows.length,
    sound: rows[0]?.sound ?? true, preview: rows[0]?.preview ?? true };
}

/** Notification creation is retried by the chat outbox; unique rows deduplicate retries. */
export async function queueNativeChatPush(client, notification, messageId) {
  if (notification?.type !== 'chat.message' || !messageId) return;
  await client.$executeRaw`
    INSERT INTO native_push_deliveries (notification_id, registration_id, message_id)
    SELECT ${notification.id}, r.id, m.id FROM native_push_registrations r
      JOIN sessions s ON s.id = r.session_id AND s."userId" = r.user_id
      JOIN users u ON u.id = r.user_id
      JOIN company_memberships cm ON cm.id = r.membership_id AND cm."userId" = r.user_id
      JOIN chat_messages m ON m.id = ${messageId} AND m.company_id = r.company_id
     WHERE r.company_id = ${notification.companyId} AND r.membership_id = ${notification.recipientMembershipId}
       AND r.created_at <= ${notification.createdAt} AND s."expiresAt" > CURRENT_TIMESTAMP
       AND cm."companyId" = r.company_id AND cm.status = 'ACTIVE' AND cm."deletedAt" IS NULL
       AND u."deletedAt" IS NULL AND m.deleted_at IS NULL
    ON CONFLICT (notification_id, registration_id) DO NOTHING
  `;
}

function failure(code) {
  const result = new Error('Native push delivery requires retry');
  result.code = code;
  return result;
}
export function nativePushRetryDelay(attempt) {
  return Math.min(30 * 60_000, 5_000 * 2 ** Math.max(0, attempt - 1));
}

export function buildNativeChatPush(item) {
  const generic = { uk: 'Нове повідомлення в чаті компанії', cs: 'Nová zpráva ve firemním chatu', en: 'New company chat message' };
  return {
    to: item.token,
    title: item.preview ? String(item.title || 'WorkTrack').slice(0, 160) : 'WorkTrack',
    body: item.preview ? String(item.body || '').slice(0, 180) : generic[item.language] || generic.uk,
    ...(item.sound ? { sound: 'default' } : {}),
    channelId: item.sound ? 'worktrack-chat' : 'worktrack-chat-silent',
    ttl: 3600,
    priority: 'default',
    data: { type: 'chat.message', notificationId: item.notificationId, companyId: item.companyId,
      membershipId: item.membershipId, messageId: item.messageId },
  };
}

export async function callExpoPush(path, body, { fetcher = fetch } = {}) {
  if (path !== 'send' && path !== 'getReceipts') error('Invalid native push operation');
  const accessToken = String(process.env.EXPO_PUSH_ACCESS_TOKEN || '').trim();
  let response;
  try {
    response = await fetcher(path === 'send' ? EXPO_SEND : EXPO_RECEIPTS, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch { throw failure('ExpoNetworkError'); }
  if (!response.ok) throw failure(response.status === 429 || response.status >= 500 ? 'ExpoUnavailable' : 'ExpoConfigurationError');
  let data;
  try { data = await response.json(); } catch { throw failure('ExpoMalformedResponse'); }
  if (!data || data.errors?.length || !data.data) throw failure('ExpoMalformedResponse');
  return data.data;
}

async function claimDelivery(client, leaseToken) {
  const rows = await client.$queryRaw`
    WITH exhausted AS (
      UPDATE native_push_deliveries SET status = 'failed', last_error = 'RetryLimitReached', updated_at = CURRENT_TIMESTAMP
       WHERE status IN ('queued', 'sending') AND attempts >= ${MAX_ATTEMPTS}
         AND (lease_until IS NULL OR lease_until <= CURRENT_TIMESTAMP) RETURNING notification_id
    ), candidate AS (
      SELECT notification_id, registration_id FROM native_push_deliveries
       WHERE status IN ('queued', 'sending', 'ticketed') AND available_at <= CURRENT_TIMESTAMP
         AND (status = 'ticketed' OR attempts < ${MAX_ATTEMPTS})
         AND (lease_until IS NULL OR lease_until <= CURRENT_TIMESTAMP)
       ORDER BY available_at, created_at FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE native_push_deliveries d SET lease_token = ${leaseToken},
      lease_until = CURRENT_TIMESTAMP + (${LEASE_MS} * INTERVAL '1 millisecond'),
      status = CASE WHEN d.ticket_id IS NOT NULL THEN 'ticketed' ELSE 'sending' END,
      attempts = CASE WHEN d.ticket_id IS NOT NULL THEN d.attempts ELSE d.attempts + 1 END, updated_at = CURRENT_TIMESTAMP
      FROM candidate c WHERE d.notification_id = c.notification_id AND d.registration_id = c.registration_id
    RETURNING d.notification_id AS "notificationId", d.registration_id AS "registrationId",
      d.message_id AS "messageId", d.ticket_id AS "ticketId", d.ticket_at AS "ticketAt", d.attempts
  `;
  return rows[0] || null;
}
async function activeDelivery(client, job) {
  const rows = await client.$queryRaw`
    SELECT r.token, r.project_id AS "projectId", r.company_id AS "companyId", r.membership_id AS "membershipId",
           r.updated_at AS "registrationUpdatedAt",
           r.language, r.sound, r.preview, n.title, n.message AS body
      FROM native_push_registrations r JOIN sessions s ON s.id = r.session_id AND s."userId" = r.user_id
      JOIN users u ON u.id = r.user_id
      JOIN company_memberships cm ON cm.id = r.membership_id AND cm."userId" = r.user_id
      JOIN notifications n ON n.id = ${job.notificationId} AND n."companyId" = r.company_id AND n."recipientMembershipId" = r.membership_id
      JOIN chat_messages m ON m.id = ${job.messageId} AND m.company_id = r.company_id
     WHERE r.id = ${job.registrationId} AND s."expiresAt" > CURRENT_TIMESTAMP
       AND cm."companyId" = r.company_id AND cm.status = 'ACTIVE' AND cm."deletedAt" IS NULL
       AND u."deletedAt" IS NULL AND m.deleted_at IS NULL AND n."readAt" IS NULL
       AND NOT EXISTS (SELECT 1 FROM chat_read_states cr WHERE cr.membership_id = r.membership_id
                        AND cr.company_id = r.company_id AND cr.last_read_at >= m.created_at)
     LIMIT 1
  `;
  return rows[0] ? { ...job, ...rows[0] } : null;
}
async function settle(client, job, leaseToken, status, code = null, { now = Date.now, ticketId = null } = {}) {
  const availableAt = new Date(now() + (status === 'ticketed' ? RECEIPT_DELAY : nativePushRetryDelay(job.attempts)));
  await client.$executeRaw`
    UPDATE native_push_deliveries SET status = ${status}, last_error = ${code}, available_at = ${availableAt},
      ticket_id = ${ticketId}, ticket_at = CASE WHEN ${ticketId}::text IS NOT NULL THEN COALESCE(ticket_at, CURRENT_TIMESTAMP) ELSE NULL END,
      lease_token = NULL, lease_until = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE notification_id = ${job.notificationId} AND registration_id = ${job.registrationId} AND lease_token = ${leaseToken}
  `;
}

/** Invoked by the existing durable chat worker, with a bounded serial batch. */
export async function processNativePushDeliveries(client, {
  request = callExpoPush, now = Date.now, makeLeaseToken = randomUUID, limit = 10,
} = {}) {
  for (let processed = 0; processed < Math.min(20, limit); processed++) {
    const leaseToken = makeLeaseToken(), job = await claimDelivery(client, leaseToken);
    if (!job) break;
    const item = await activeDelivery(client, job);
    if (!item || !projectAllowed(item.projectId) || !TOKEN.test(item.token)) {
      await settle(client, job, leaseToken, 'failed', 'AccessRevoked', { now });
      continue;
    }
    try {
      let result;
      if (job.ticketId) {
        result = (await request('getReceipts', { ids: [job.ticketId] }))[job.ticketId];
        if (!result) {
          if (now() - new Date(job.ticketAt).getTime() >= 23 * 60 * 60_000) {
            await settle(client, job, leaseToken, 'failed', 'ReceiptUnavailable', { now });
          } else await settle(client, job, leaseToken, 'ticketed', null, { now, ticketId: job.ticketId });
          continue;
        }
      } else {
        const response = await request('send', buildNativeChatPush(item));
        result = Array.isArray(response) ? response[0] : response;
      }
      if (result?.status === 'ok') {
        if (!job.ticketId && (typeof result.id !== 'string' || !RECEIPT_ID.test(result.id))) throw failure('ExpoMalformedResponse');
        await settle(client, job, leaseToken, job.ticketId ? 'delivered' : 'ticketed', null,
          { now, ticketId: job.ticketId || result.id });
      } else if (result?.details?.error === 'DeviceNotRegistered') {
        // Old receipts cannot revoke a token refreshed after that ticket was issued.
        if (!job.ticketAt || new Date(item.registrationUpdatedAt).getTime() <= new Date(job.ticketAt).getTime()) {
          await client.$executeRaw`DELETE FROM native_push_registrations
            WHERE id = ${job.registrationId} AND updated_at = ${item.registrationUpdatedAt}`;
        }
        await settle(client, job, leaseToken, 'failed', 'DeviceNotRegistered', { now });
      } else if (job.ticketId && result?.details?.error === 'MessageRateExceeded') {
        await settle(client, job, leaseToken, job.attempts < MAX_ATTEMPTS ? 'queued' : 'failed',
          'MessageRateExceeded', { now });
      } else {
        const code = result?.details?.error || 'ExpoMalformedResponse';
        throw failure(RETRYABLE_CODES.has(code) ? code : 'ExpoConfigurationError');
      }
    } catch (cause) {
      const code = RETRYABLE_CODES.has(cause?.code) ? cause.code : 'ExpoConfigurationError';
      const retryAllowed = job.ticketId
        ? now() - new Date(job.ticketAt).getTime() < 23 * 60 * 60_000
        : job.attempts < MAX_ATTEMPTS;
      const status = RETRYABLE_CODES.has(code) && retryAllowed ? 'queued' : 'failed';
      // Retain accepted tickets on receipt endpoint errors; never resend their payload.
      await settle(client, job, leaseToken, job.ticketId && status === 'queued' ? 'ticketed' : status,
        code, { now, ticketId: job.ticketId });
    }
  }
  await client.$executeRaw`
    DELETE FROM native_push_deliveries WHERE status IN ('delivered', 'failed')
      AND updated_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
  `;
  await client.$executeRaw`
    DELETE FROM native_push_registrations r WHERE NOT EXISTS (
      SELECT 1 FROM sessions s WHERE s.id = r.session_id AND s."expiresAt" > CURRENT_TIMESTAMP
    ) OR NOT EXISTS (SELECT 1 FROM company_memberships cm WHERE cm.id = r.membership_id
      AND cm."userId" = r.user_id AND cm."companyId" = r.company_id AND cm.status = 'ACTIVE' AND cm."deletedAt" IS NULL)
  `;
}
