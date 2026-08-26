ALTER TABLE "work_entries"
ADD COLUMN "hourlyRateCzk" DECIMAL(10,2);

UPDATE "work_entries" AS entry
SET "hourlyRateCzk" = membership."hourlyRateCzk"
FROM "company_memberships" AS membership
WHERE entry."employeeMembershipId" = membership."id"
  AND entry."hourlyRateCzk" IS NULL;

CREATE OR REPLACE FUNCTION snapshot_work_entry_hourly_rate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."hourlyRateCzk" IS NULL THEN
    SELECT membership."hourlyRateCzk"
      INTO NEW."hourlyRateCzk"
    FROM "company_memberships" AS membership
    WHERE membership."id" = NEW."employeeMembershipId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_entries_snapshot_hourly_rate
BEFORE INSERT ON "work_entries"
FOR EACH ROW
EXECUTE FUNCTION snapshot_work_entry_hourly_rate();
