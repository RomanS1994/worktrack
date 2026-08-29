CREATE TABLE "salary_advances" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeMembershipId" TEXT NOT NULL,
  "managerMembershipId" TEXT NOT NULL,
  "amountCzk" DECIMAL(12,2) NOT NULL,
  "paidAt" DATE NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "salary_advances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "salary_advances_companyId_paidAt_idx" ON "salary_advances"("companyId", "paidAt");
CREATE INDEX "salary_advances_employeeMembershipId_paidAt_idx" ON "salary_advances"("employeeMembershipId", "paidAt");
CREATE INDEX "salary_advances_managerMembershipId_idx" ON "salary_advances"("managerMembershipId");

ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_employeeMembershipId_fkey" FOREIGN KEY ("employeeMembershipId") REFERENCES "company_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_managerMembershipId_fkey" FOREIGN KEY ("managerMembershipId") REFERENCES "company_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
