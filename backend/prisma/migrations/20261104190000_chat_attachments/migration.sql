CREATE TABLE "chat_attachments" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "uploader_membership_id" TEXT NOT NULL,
  "message_id" TEXT,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_data" BYTEA NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_attachments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chat_attachments_uploader_membership_id_fkey" FOREIGN KEY ("uploader_membership_id") REFERENCES "company_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chat_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "chat_attachments_message_id_idx" ON "chat_attachments"("message_id");
CREATE INDEX "chat_attachments_company_uploader_created_idx" ON "chat_attachments"("company_id", "uploader_membership_id", "created_at");
