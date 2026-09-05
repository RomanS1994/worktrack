CREATE TABLE "chat_messages" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "author_membership_id" TEXT NOT NULL,
  "client_message_id" TEXT,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "edited_at" TIMESTAMPTZ,
  "deleted_at" TIMESTAMPTZ,
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_read_states" (
  "membership_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "last_read_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_read_states_pkey" PRIMARY KEY ("membership_id")
);

CREATE INDEX "chat_messages_company_created_idx"
  ON "chat_messages" ("company_id", "created_at" DESC);
CREATE INDEX "chat_messages_author_created_idx"
  ON "chat_messages" ("author_membership_id", "created_at" DESC);
CREATE UNIQUE INDEX "chat_messages_author_client_id_uq"
  ON "chat_messages" ("author_membership_id", "client_message_id")
  WHERE "client_message_id" IS NOT NULL;
CREATE INDEX "chat_read_states_company_idx"
  ON "chat_read_states" ("company_id");

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_author_membership_id_fkey"
  FOREIGN KEY ("author_membership_id") REFERENCES "company_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_read_states"
  ADD CONSTRAINT "chat_read_states_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_read_states"
  ADD CONSTRAINT "chat_read_states_membership_id_fkey"
  FOREIGN KEY ("membership_id") REFERENCES "company_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
