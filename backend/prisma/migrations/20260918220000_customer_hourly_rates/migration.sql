-- Customer billing rate is manager-only financial data. Existing memberships fall back to their pay rate.
ALTER TABLE "company_memberships" ADD COLUMN "customerRateCzk" DECIMAL(10,2);
-- Snapshot billing rates on new work entries so later rate edits do not rewrite historical revenue.
ALTER TABLE "work_entries" ADD COLUMN "customerRateCzk" DECIMAL(10,2);
