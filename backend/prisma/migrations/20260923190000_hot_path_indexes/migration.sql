-- Composite indexes for dashboard, payroll, invoice and timesheet range reads.
CREATE INDEX IF NOT EXISTS "work_entries_companyId_status_workDate_idx"
  ON "work_entries"("companyId", "status", "workDate");

CREATE INDEX IF NOT EXISTS "weekly_submissions_companyId_status_weekStart_idx"
  ON "weekly_submissions"("companyId", "status", "weekStart");
