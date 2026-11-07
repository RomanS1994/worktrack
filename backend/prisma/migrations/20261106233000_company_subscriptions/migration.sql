CREATE TYPE "CompanySubscriptionStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'GRACE_PERIOD', 'EXPIRED');
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING', 'REVIEW_REQUESTED', 'PAID', 'REJECTED', 'OVERDUE');

CREATE TABLE "company_subscriptions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL DEFAULT 'TEAM_1_5',
    "employeeLimit" INTEGER NOT NULL DEFAULT 5,
    "monthlyPriceCzk" DECIMAL(10,2) NOT NULL DEFAULT 490,
    "status" "CompanySubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "gracePeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "company_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "employeeLimit" INTEGER NOT NULL,
    "amountCzk" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CZK',
    "variableSymbol" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewRequestedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "reviewedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_subscriptions_companyId_key" ON "company_subscriptions"("companyId");
CREATE INDEX "company_subscriptions_status_currentPeriodEnd_idx" ON "company_subscriptions"("status", "currentPeriodEnd");
CREATE UNIQUE INDEX "subscription_payments_invoiceNumber_key" ON "subscription_payments"("invoiceNumber");
CREATE UNIQUE INDEX "subscription_payments_variableSymbol_key" ON "subscription_payments"("variableSymbol");
CREATE INDEX "subscription_payments_companyId_status_createdAt_idx" ON "subscription_payments"("companyId", "status", "createdAt");
CREATE INDEX "subscription_payments_status_dueDate_idx" ON "subscription_payments"("status", "dueDate");

ALTER TABLE "company_subscriptions" ADD CONSTRAINT "company_subscriptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
