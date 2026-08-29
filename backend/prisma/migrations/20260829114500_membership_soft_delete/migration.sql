ALTER TABLE "company_memberships"
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "company_memberships_companyId_deletedAt_idx"
ON "company_memberships"("companyId", "deletedAt");
