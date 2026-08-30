-- One-time cleanup requested for WorkTrack invoice data.
-- Work entries/hours remain untouched. Invoice items are removed by cascade from invoices.

DELETE FROM "notifications"
WHERE "type" LIKE 'invoice.%';

DELETE FROM "audit_logs"
WHERE "entityType" = 'Invoice';

DELETE FROM "invoices";
