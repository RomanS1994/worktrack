ALTER TABLE "work_entries"
ADD COLUMN "hourlyRateCzk" DECIMAL(10,2);

UPDATE "work_entries" AS entry
SET "hourlyRateCzk" = membership."hourlyRateCzk"
FROM "company_memberships" AS membership
WHERE entry."employeeMembershipId" = membership."id"
  AND entry."hourlyRateCzk" IS NULL;

UPDATE "work_entries" AS entry
SET "breakMinutes" = company."breakMinutes"
FROM "companies" AS company
WHERE entry."companyId" = company."id"
  AND entry."grossHours" IS NULL;

CREATE OR REPLACE FUNCTION snapshot_work_entry_context()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."hourlyRateCzk" IS NULL THEN
    SELECT membership."hourlyRateCzk"
      INTO NEW."hourlyRateCzk"
    FROM "company_memberships" AS membership
    WHERE membership."id" = NEW."employeeMembershipId";
  END IF;

  SELECT company."breakMinutes"
    INTO NEW."breakMinutes"
  FROM "companies" AS company
  WHERE company."id" = NEW."companyId";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_entries_snapshot_context
BEFORE INSERT ON "work_entries"
FOR EACH ROW
EXECUTE FUNCTION snapshot_work_entry_context();
