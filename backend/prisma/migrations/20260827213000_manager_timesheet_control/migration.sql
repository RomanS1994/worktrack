CREATE TABLE "manager_timesheet_entries" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeMembershipId" TEXT NOT NULL,
  "managerMembershipId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "hours" DECIMAL(5,2),
  "breakMinutes" INTEGER,
  "projectId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "manager_timesheet_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "manager_timesheet_entries_employeeMembershipId_workDate_key"
  ON "manager_timesheet_entries"("employeeMembershipId", "workDate");
CREATE INDEX "manager_timesheet_entries_companyId_workDate_idx"
  ON "manager_timesheet_entries"("companyId", "workDate");
CREATE INDEX "manager_timesheet_entries_managerMembershipId_idx"
  ON "manager_timesheet_entries"("managerMembershipId");

ALTER TABLE "manager_timesheet_entries"
  ADD CONSTRAINT "manager_timesheet_entries_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manager_timesheet_entries"
  ADD CONSTRAINT "manager_timesheet_entries_employeeMembershipId_fkey"
  FOREIGN KEY ("employeeMembershipId") REFERENCES "company_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manager_timesheet_entries"
  ADD CONSTRAINT "manager_timesheet_entries_managerMembershipId_fkey"
  FOREIGN KEY ("managerMembershipId") REFERENCES "company_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manager_timesheet_entries"
  ADD CONSTRAINT "manager_timesheet_entries_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
