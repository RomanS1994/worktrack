BEGIN;

CREATE TYPE "MembershipRole" AS ENUM ('MANAGER', 'EMPLOYEE');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "users"
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "companies" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_memberships" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL,
  "hourlyRateCzk" DECIMAL(10,2),
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "work_entries"
  ADD COLUMN "companyId" TEXT,
  ADD COLUMN "employeeMembershipId" TEXT,
  ADD COLUMN "projectId" TEXT;

ALTER TABLE "weekly_submissions"
  ADD COLUMN "companyId" TEXT,
  ADD COLUMN "employeeMembershipId" TEXT,
  ADD COLUMN "reviewedByMembershipId" TEXT;

INSERT INTO "companies" ("id", "name", "slug", "createdAt", "updatedAt")
SELECT
  'company_legacy_worktrack',
  'WorkTrack Company',
  'worktrack-company',
  COALESCE(MIN("createdAt"), CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "users"
HAVING COUNT(*) > 0;

INSERT INTO "company_memberships" (
  "id",
  "companyId",
  "userId",
  "role",
  "hourlyRateCzk",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  'membership_' || "users"."id",
  'company_legacy_worktrack',
  "users"."id",
  ("users"."role"::text)::"MembershipRole",
  CASE
    WHEN "users"."role" = 'EMPLOYEE' THEN "users"."hourlyRateCzk"
    ELSE NULL
  END,
  'ACTIVE',
  "users"."createdAt",
  CURRENT_TIMESTAMP
FROM "users"
WHERE EXISTS (
  SELECT 1 FROM "companies" WHERE "companies"."id" = 'company_legacy_worktrack'
);

INSERT INTO "projects" (
  "id",
  "companyId",
  "name",
  "address",
  "description",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'project_legacy_general',
  'company_legacy_worktrack',
  'General Work',
  NULL,
  'Migrated project for existing work entries.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "work_entries")
  AND EXISTS (
    SELECT 1 FROM "companies" WHERE "companies"."id" = 'company_legacy_worktrack'
  );

UPDATE "work_entries"
SET
  "companyId" = (
    SELECT "company_memberships"."companyId"
    FROM "company_memberships"
    WHERE "company_memberships"."userId" = "work_entries"."employeeId"
    LIMIT 1
  ),
  "employeeMembershipId" = (
    SELECT "company_memberships"."id"
    FROM "company_memberships"
    WHERE "company_memberships"."userId" = "work_entries"."employeeId"
    LIMIT 1
  ),
  "projectId" = 'project_legacy_general'
WHERE "companyId" IS NULL;

UPDATE "weekly_submissions"
SET
  "companyId" = (
    SELECT "company_memberships"."companyId"
    FROM "company_memberships"
    WHERE "company_memberships"."userId" = "weekly_submissions"."employeeId"
    LIMIT 1
  ),
  "employeeMembershipId" = (
    SELECT "company_memberships"."id"
    FROM "company_memberships"
    WHERE "company_memberships"."userId" = "weekly_submissions"."employeeId"
    LIMIT 1
  ),
  "reviewedByMembershipId" = CASE
    WHEN "managerId" IS NULL THEN NULL
    ELSE (
      SELECT "reviewer"."id"
      FROM "company_memberships" AS "reviewer"
      WHERE "reviewer"."userId" = "weekly_submissions"."managerId"
        AND "reviewer"."companyId" = (
          SELECT "employeeMembership"."companyId"
          FROM "company_memberships" AS "employeeMembership"
          WHERE "employeeMembership"."userId" = "weekly_submissions"."employeeId"
          LIMIT 1
        )
      LIMIT 1
    )
  END
WHERE "companyId" IS NULL;

ALTER TABLE "work_entries"
  ALTER COLUMN "employeeId" DROP NOT NULL,
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "employeeMembershipId" SET NOT NULL,
  ALTER COLUMN "projectId" SET NOT NULL;

ALTER TABLE "weekly_submissions"
  ALTER COLUMN "employeeId" DROP NOT NULL,
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "employeeMembershipId" SET NOT NULL;

CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");
CREATE INDEX "companies_slug_idx" ON "companies"("slug");

CREATE UNIQUE INDEX "company_memberships_companyId_userId_key"
  ON "company_memberships"("companyId", "userId");
CREATE INDEX "company_memberships_userId_idx" ON "company_memberships"("userId");
CREATE INDEX "company_memberships_companyId_role_idx"
  ON "company_memberships"("companyId", "role");
CREATE INDEX "company_memberships_companyId_status_idx"
  ON "company_memberships"("companyId", "status");

CREATE INDEX "projects_companyId_idx" ON "projects"("companyId");
CREATE INDEX "projects_companyId_isActive_idx" ON "projects"("companyId", "isActive");

CREATE UNIQUE INDEX "work_entries_employeeMembershipId_projectId_workDate_key"
  ON "work_entries"("employeeMembershipId", "projectId", "workDate");
CREATE INDEX "work_entries_companyId_idx" ON "work_entries"("companyId");
CREATE INDEX "work_entries_employeeMembershipId_idx" ON "work_entries"("employeeMembershipId");
CREATE INDEX "work_entries_employeeMembershipId_workDate_idx"
  ON "work_entries"("employeeMembershipId", "workDate");
CREATE INDEX "work_entries_projectId_idx" ON "work_entries"("projectId");

CREATE UNIQUE INDEX "weekly_submissions_employeeMembershipId_weekStart_key"
  ON "weekly_submissions"("employeeMembershipId", "weekStart");
CREATE INDEX "weekly_submissions_companyId_idx" ON "weekly_submissions"("companyId");
CREATE INDEX "weekly_submissions_employeeMembershipId_idx"
  ON "weekly_submissions"("employeeMembershipId");
CREATE INDEX "weekly_submissions_reviewedByMembershipId_idx"
  ON "weekly_submissions"("reviewedByMembershipId");

ALTER TABLE "company_memberships"
  ADD CONSTRAINT "company_memberships_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_memberships"
  ADD CONSTRAINT "company_memberships_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_entries"
  ADD CONSTRAINT "work_entries_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_entries"
  ADD CONSTRAINT "work_entries_employeeMembershipId_fkey"
  FOREIGN KEY ("employeeMembershipId") REFERENCES "company_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_entries"
  ADD CONSTRAINT "work_entries_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "weekly_submissions"
  ADD CONSTRAINT "weekly_submissions_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "weekly_submissions"
  ADD CONSTRAINT "weekly_submissions_employeeMembershipId_fkey"
  FOREIGN KEY ("employeeMembershipId") REFERENCES "company_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "weekly_submissions"
  ADD CONSTRAINT "weekly_submissions_reviewedByMembershipId_fkey"
  FOREIGN KEY ("reviewedByMembershipId") REFERENCES "company_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
