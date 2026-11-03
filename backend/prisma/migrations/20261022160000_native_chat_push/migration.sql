-- Tokens are server-owned records: never serialize them into public user profiles.
CREATE TABLE "native_push_registrations" (
  "id" TEXT PRIMARY KEY,
  "token" TEXT NOT NULL UNIQUE,
  "installation_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "membership_id" TEXT NOT NULL REFERENCES "company_memberships"("id") ON DELETE CASCADE,
  "company_id" TEXT NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "session_id" TEXT NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "platform" TEXT NOT NULL CHECK ("platform" IN ('ios', 'android')),
  "language" TEXT NOT NULL DEFAULT 'uk' CHECK ("language" IN ('uk', 'cs', 'en')),
  "sound" BOOLEAN NOT NULL DEFAULT true,
  "preview" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("project_id", "installation_id")
);
CREATE INDEX "native_push_registrations_recipient_idx"
  ON "native_push_registrations" ("company_id", "membership_id");
CREATE INDEX "native_push_registrations_session_idx" ON "native_push_registrations" ("session_id");

CREATE TABLE "native_push_deliveries" (
  "notification_id" TEXT NOT NULL REFERENCES "notifications"("id") ON DELETE CASCADE,
  "registration_id" TEXT NOT NULL REFERENCES "native_push_registrations"("id") ON DELETE CASCADE,
  "message_id" TEXT NOT NULL REFERENCES "chat_messages"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'queued' CHECK ("status" IN ('queued', 'sending', 'ticketed', 'delivered', 'failed')),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_token" TEXT,
  "lease_until" TIMESTAMPTZ,
  "ticket_id" TEXT,
  "ticket_at" TIMESTAMPTZ,
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("notification_id", "registration_id")
);
CREATE INDEX "native_push_deliveries_queue_idx" ON "native_push_deliveries" ("available_at")
  WHERE "status" IN ('queued', 'sending', 'ticketed');
