# Chat reliability rollout

This patch supports the independent mobile application's durable outbox and complete timeline recovery. It also preserves existing latest/beforeId chat endpoints for web clients. It has not been deployed or run against production data.

## Deployment order

1. Apply `prisma migrate deploy` with migration `20261022140000_chat_notification_outbox` on staging first. New message writes atomically enqueue into this table, so the migration must precede new API code.
2. Start the API. Its bounded PostgreSQL-backed notification worker starts with the server; no additional paid queue service is required.
3. Verify message plus job transaction rollback, simultaneous same-clientMessageId sends, two-worker SKIP LOCKED claiming, lease recovery after process termination, notification idempotency and deleted/archived recipients.
4. Verify ascending afterId pages, requestedIds snapshots and SSE access revocation from two clients.
5. Distribute the matching rebuilt mobile preview and perform device acceptance before production rollout.

## Guarantees and bounds

- Message insertion and outbox insertion share a transaction. Duplicate sends return the original stable ID and never emit another new-message event or enqueue another job. Deleted duplicate acknowledgements redact the message and reply text.
- Notification jobs use token-fenced renewable leases, bounded concurrency, eight attempts, exponential backoff, and retention of completed jobs for seven days / failed jobs for thirty days. Failed jobs require operational review; failures are not silently retried forever.
- In-app notification IDs are deterministic per message/recipient. Retrying preserves read state. External Web Push remains at-least-once and has a 15-second HTTP timeout; native APNs/Expo push is not introduced.
- Open SSE streams expire with the token/session and recheck access every 15 seconds, failing closed after a five-second authorization timeout. Revocation is bounded, not instantaneous.
- Limits are six streams per member and 1,000 per API process. Slow clients disconnect and recover through history replay. Mutation limits isolate company, member and action.
- SSE delivery and mutation limits remain process-local. Multi-instance deployment needs shared pub/sub and a distributed limiter; the PostgreSQL queue itself supports multiple workers.

## Tests and current limits

`node --test tests/chat-*.test.js tests/company-chat-read.test.js tests/notifications.test.js` exercises scoped history, duplicate/concurrent adapters, access revocation, stream cleanup, bounds and durable queue retries. The SQL is exercised through injected adapters, not a live PostgreSQL concurrency run.

The current environment's broad backend suite cannot import `pdfmake/build/pdfmake.js` for the unrelated route-contract test. Do not describe that broad suite as fully passing. Staging migration, physical-device acceptance and native push remain release gates.
