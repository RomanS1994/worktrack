CREATE TABLE "company_expenses" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "managerMembershipId" TEXT NOT NULL,
    "amountCzk" DECIMAL(12,2) NOT NULL,
    "spentAt" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_expenses_companyId_spentAt_idx" ON "company_expenses"("companyId", "spentAt");
CREATE INDEX "company_expenses_managerMembershipId_idx" ON "company_expenses"("managerMembershipId");
CREATE INDEX "company_expenses_companyId_category_idx" ON "company_expenses"("companyId", "category");

ALTER TABLE "company_expenses" ADD CONSTRAINT "company_expenses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_expenses" ADD CONSTRAINT "company_expenses_managerMembershipId_fkey" FOREIGN KEY ("managerMembershipId") REFERENCES "company_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
