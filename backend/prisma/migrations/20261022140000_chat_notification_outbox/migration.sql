-- Enqueued in the same transaction as chat_messages; safe for multiple API workers.
CREATE TABLE "chat_notification_outbox" (
  "message_id" TEXT NOT NULL PRIMARY KEY REFERENCES "chat_messages"("id") ON DELETE CASCADE,
  "company_id" TEXT NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "author_membership_id" TEXT NOT NULL REFERENCES "company_memberships"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "available_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" >= 0),
  "lease_token" TEXT,
  "lease_until" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "failed_at" TIMESTAMPTZ,
  "last_error" TEXT,
  CHECK (("lease_token" IS NULL) = ("lease_until" IS NULL))
);
CREATE INDEX "chat_notification_outbox_available_idx"
  ON "chat_notification_outbox" ("available_at", "created_at")
  WHERE "completed_at" IS NULL AND "failed_at" IS NULL;
