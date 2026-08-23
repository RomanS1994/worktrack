ALTER TABLE "companies"
ADD COLUMN "breakMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "standardDailyHours" DECIMAL(5,2) NOT NULL DEFAULT 8.00;

ALTER TABLE "work_entries"
ADD COLUMN "grossHours" DECIMAL(5,2),
ADD COLUMN "breakMinutes" INTEGER NOT NULL DEFAULT 0;

UPDATE "work_entries"
SET "grossHours" = "hours"
WHERE "grossHours" IS NULL;
