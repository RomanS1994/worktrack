CREATE TABLE "chat_message_reactions" (
  "message_id" TEXT NOT NULL,
  "membership_id" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "chat_message_reactions_pkey" PRIMARY KEY ("message_id", "membership_id", "emoji")
);

CREATE INDEX "chat_message_reactions_message_idx"
  ON "chat_message_reactions" ("message_id");

ALTER TABLE "chat_message_reactions"
  ADD CONSTRAINT "chat_message_reactions_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_message_reactions"
  ADD CONSTRAINT "chat_message_reactions_membership_id_fkey"
  FOREIGN KEY ("membership_id") REFERENCES "company_memberships"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
