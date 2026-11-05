-- Create one general room for every company, then move the existing company-wide
-- conversation into that room. Existing messages and read markers are preserved.
CREATE TABLE "chat_rooms" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'GROUP',
  "created_by_membership_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_rooms_type_check" CHECK ("type" IN ('COMPANY', 'GROUP')),
  CONSTRAINT "chat_rooms_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chat_rooms_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "company_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "chat_rooms_company_updated_idx" ON "chat_rooms"("company_id", "updated_at" DESC);
CREATE UNIQUE INDEX "chat_rooms_one_company_room_uq" ON "chat_rooms"("company_id") WHERE "type" = 'COMPANY';

CREATE TABLE "chat_room_members" (
  "room_id" TEXT NOT NULL,
  "membership_id" TEXT NOT NULL,
  "added_by_membership_id" TEXT,
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "left_at" TIMESTAMP(3),
  CONSTRAINT "chat_room_members_pkey" PRIMARY KEY ("room_id", "membership_id"),
  CONSTRAINT "chat_room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chat_room_members_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "company_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chat_room_members_added_by_membership_id_fkey" FOREIGN KEY ("added_by_membership_id") REFERENCES "company_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "chat_room_members_membership_room_idx" ON "chat_room_members"("membership_id", "room_id");

-- A deterministic room ID makes the backfill stable and avoids a dependency on
-- database-specific UUID extensions.
INSERT INTO "chat_rooms" ("id", "company_id", "name", "type", "created_at", "updated_at")
SELECT md5('worktrack-company-chat:' || c."id"), c."id", 'Загальний чат', 'COMPANY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c;

-- Keep all existing memberships represented in the general room. Runtime
-- authorization must still require an active company membership.
INSERT INTO "chat_room_members" ("room_id", "membership_id", "joined_at")
SELECT r."id", cm."id", cm."createdAt"
FROM "chat_rooms" r
JOIN "company_memberships" cm ON cm."companyId" = r."company_id"
WHERE r."type" = 'COMPANY';

ALTER TABLE "chat_messages" ADD COLUMN "room_id" TEXT;
UPDATE "chat_messages" m
SET "room_id" = r."id"
FROM "chat_rooms" r
WHERE r."company_id" = m."company_id" AND r."type" = 'COMPANY';
ALTER TABLE "chat_messages" ALTER COLUMN "room_id" SET NOT NULL;
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "chat_messages_room_created_idx" ON "chat_messages"("room_id", "created_at" DESC, "id" DESC);

ALTER TABLE "chat_read_states" ADD COLUMN "room_id" TEXT;
UPDATE "chat_read_states" s
SET "room_id" = r."id"
FROM "chat_rooms" r
WHERE r."company_id" = s."company_id" AND r."type" = 'COMPANY';
ALTER TABLE "chat_read_states" ALTER COLUMN "room_id" SET NOT NULL;
ALTER TABLE "chat_read_states" DROP CONSTRAINT "chat_read_states_pkey";
ALTER TABLE "chat_read_states" ADD CONSTRAINT "chat_read_states_pkey" PRIMARY KEY ("room_id", "membership_id");
ALTER TABLE "chat_read_states"
  ADD CONSTRAINT "chat_read_states_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "chat_read_states_room_idx" ON "chat_read_states"("room_id");

-- Message retry IDs only need to be unique within a room once group chats exist.
DROP INDEX "chat_messages_author_client_id_uq";
CREATE UNIQUE INDEX "chat_messages_author_client_id_uq"
  ON "chat_messages" ("room_id", "author_membership_id", "client_message_id")
  WHERE "client_message_id" IS NOT NULL;
