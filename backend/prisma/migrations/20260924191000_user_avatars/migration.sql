CREATE TABLE IF NOT EXISTS "user_avatars" (
  "userId" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "hash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX IF NOT EXISTS "user_avatars_hash_idx" ON "user_avatars"("hash");

ALTER TABLE "user_avatars"
  ADD CONSTRAINT "user_avatars_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;