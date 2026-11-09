ALTER TABLE "company_subscriptions"
  ADD COLUMN "billingPeriod" TEXT NOT NULL DEFAULT 'month',
  ADD COLUMN "scheduledPlanCode" TEXT,
  ADD COLUMN "scheduledEmployeeLimit" INTEGER,
  ADD COLUMN "scheduledMonthlyPriceCzk" DECIMAL(10,2),
  ADD COLUMN "scheduledBillingPeriod" TEXT,
  ADD COLUMN "scheduledEffectiveAt" TIMESTAMP(3),
  ADD COLUMN "scheduledPeriodEnd" TIMESTAMP(3);

ALTER TABLE "subscription_payments"
  ADD COLUMN "changeType" TEXT NOT NULL DEFAULT 'RENEWAL',
  ADD COLUMN "billingPeriod" TEXT NOT NULL DEFAULT 'month';

UPDATE "company_subscriptions"
SET "billingPeriod" = 'year'
WHERE "currentPeriodStart" IS NOT NULL
  AND "currentPeriodEnd" IS NOT NULL
  AND "currentPeriodEnd" - "currentPeriodStart" >= INTERVAL '11 months';
