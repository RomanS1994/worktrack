ALTER TABLE "company_memberships"
ADD COLUMN "defaultProjectId" TEXT;

CREATE INDEX "company_memberships_defaultProjectId_idx"
ON "company_memberships"("defaultProjectId");

ALTER TABLE "company_memberships"
ADD CONSTRAINT "company_memberships_defaultProjectId_fkey"
FOREIGN KEY ("defaultProjectId") REFERENCES "projects"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
