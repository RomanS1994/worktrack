BEGIN;

-- Legacy weekly submissions could span a calendar month even when only the
-- first-month work entries were actually submitted. Shorten only those safe
-- cases so the next month's dates in the same calendar week become editable.
UPDATE "weekly_submissions" AS ws
SET "weekEnd" = (
  date_trunc('month', ws."weekStart") + INTERVAL '1 month - 1 day'
)
WHERE date_trunc('month', ws."weekStart") <> date_trunc('month', ws."weekEnd")
  AND NOT EXISTS (
    SELECT 1
    FROM "work_entries" AS we
    WHERE we."weeklySubmissionId" = ws."id"
      AND we."workDate" >= date_trunc('month', ws."weekStart") + INTERVAL '1 month'
  );

COMMIT;
