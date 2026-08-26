ALTER TABLE "work_entries"
ADD COLUMN "hourlyRateCzk" DECIMAL(10,2);

UPDATE "work_entries" AS entry
SET "hourlyRateCzk" = membership."hourlyRateCzk"
FROM "company_memberships" AS membership
WHERE entry."employeeMembershipId" = membership."id"
  AND entry."hourlyRateCzk" IS NULL;
