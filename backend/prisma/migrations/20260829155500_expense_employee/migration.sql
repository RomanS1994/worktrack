ALTER TABLE "company_expenses" ADD COLUMN "employeeMembershipId" TEXT;

CREATE INDEX "company_expenses_employeeMembershipId_idx" ON "company_expenses"("employeeMembershipId");

ALTER TABLE "company_expenses"
ADD CONSTRAINT "company_expenses_employeeMembershipId_fkey"
FOREIGN KEY ("employeeMembershipId") REFERENCES "company_memberships"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
