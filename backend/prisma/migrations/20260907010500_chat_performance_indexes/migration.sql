-- Hot-path indexes for company chat reads.
-- Keep the existing general indexes; these partial/covering indexes target the
-- queries used by message history, unread counts and reaction aggregation.

CREATE INDEX IF NOT EXISTS "chat_messages_company_active_created_idx"
  ON "chat_messages" ("company_id", "created_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "chat_message_reactions_message_emoji_membership_idx"
  ON "chat_message_reactions" ("message_id", "emoji", "membership_id");
