UPDATE "work_entries" AS entry
SET "customerRateCzk" = COALESCE(membership."customerRateCzk", membership."hourlyRateCzk")
FROM "company_memberships" AS membership
WHERE entry."employeeMembershipId" = membership."id"
  AND entry."customerRateCzk" IS NULL;

CREATE OR REPLACE FUNCTION snapshot_work_entry_context()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."hourlyRateCzk" IS NULL THEN
    SELECT membership."hourlyRateCzk"
      INTO NEW."hourlyRateCzk"
    FROM "company_memberships" AS membership
    WHERE membership."id" = NEW."employeeMembershipId";
  END IF;

  IF NEW."customerRateCzk" IS NULL THEN
    SELECT COALESCE(membership."customerRateCzk", membership."hourlyRateCzk")
      INTO NEW."customerRateCzk"
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
