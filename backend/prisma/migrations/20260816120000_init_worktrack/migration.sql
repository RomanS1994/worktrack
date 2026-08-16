CREATE TYPE "UserRole" AS ENUM ('MANAGER', 'EMPLOYEE');
CREATE TYPE "WorkEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE "WeeklySubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "firstName" TEXT NOT NULL DEFAULT '',
  "lastName" TEXT NOT NULL DEFAULT '',
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
  "managerId" TEXT,
  "hourlyRateCzk" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "profile" JSONB NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "work_entries" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "weeklySubmissionId" TEXT,
  "workDate" TIMESTAMP(3) NOT NULL,
  "hours" DECIMAL(5,2) NOT NULL,
  "status" "WorkEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "work_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "weekly_submissions" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "managerId" TEXT,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "weekEnd" TIMESTAMP(3) NOT NULL,
  "status" "WeeklySubmissionStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "weekly_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorUserId" TEXT,
  "targetUserId" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE INDEX "users_managerId_idx" ON "users"("managerId");
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

CREATE INDEX "work_entries_employeeId_idx" ON "work_entries"("employeeId");
CREATE INDEX "work_entries_employeeId_workDate_idx" ON "work_entries"("employeeId", "workDate");
CREATE INDEX "work_entries_weeklySubmissionId_idx" ON "work_entries"("weeklySubmissionId");
CREATE INDEX "work_entries_status_idx" ON "work_entries"("status");

CREATE UNIQUE INDEX "weekly_submissions_employeeId_weekStart_key"
  ON "weekly_submissions"("employeeId", "weekStart");
CREATE INDEX "weekly_submissions_employeeId_idx" ON "weekly_submissions"("employeeId");
CREATE INDEX "weekly_submissions_managerId_idx" ON "weekly_submissions"("managerId");
CREATE INDEX "weekly_submissions_status_idx" ON "weekly_submissions"("status");
CREATE INDEX "weekly_submissions_weekStart_idx" ON "weekly_submissions"("weekStart");

CREATE INDEX "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");
CREATE INDEX "audit_logs_targetUserId_idx" ON "audit_logs"("targetUserId");
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

ALTER TABLE "users"
  ADD CONSTRAINT "users_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_entries"
  ADD CONSTRAINT "work_entries_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_entries"
  ADD CONSTRAINT "work_entries_weeklySubmissionId_fkey"
  FOREIGN KEY ("weeklySubmissionId") REFERENCES "weekly_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "weekly_submissions"
  ADD CONSTRAINT "weekly_submissions_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "weekly_submissions"
  ADD CONSTRAINT "weekly_submissions_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
