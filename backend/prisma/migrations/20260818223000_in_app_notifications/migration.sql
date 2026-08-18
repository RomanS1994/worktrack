CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "recipientMembershipId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "href" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_companyId_idx" ON "notifications"("companyId");
CREATE INDEX "notifications_recipientMembershipId_createdAt_idx" ON "notifications"("recipientMembershipId", "createdAt");
CREATE INDEX "notifications_recipientMembershipId_readAt_idx" ON "notifications"("recipientMembershipId", "readAt");

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_recipientMembershipId_fkey"
FOREIGN KEY ("recipientMembershipId") REFERENCES "company_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
