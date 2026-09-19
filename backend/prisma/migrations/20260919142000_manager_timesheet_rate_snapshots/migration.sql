ALTER TABLE "manager_timesheet_entries"
ADD COLUMN "hourlyRateCzk" DECIMAL(10,2),
ADD COLUMN "customerRateCzk" DECIMAL(10,2);

UPDATE "manager_timesheet_entries" AS entry
SET
  "hourlyRateCzk" = membership."hourlyRateCzk",
  "customerRateCzk" = COALESCE(membership."customerRateCzk", membership."hourlyRateCzk")
FROM "company_memberships" AS membership
WHERE entry."employeeMembershipId" = membership."id"
  AND (entry."hourlyRateCzk" IS NULL OR entry."customerRateCzk" IS NULL);
