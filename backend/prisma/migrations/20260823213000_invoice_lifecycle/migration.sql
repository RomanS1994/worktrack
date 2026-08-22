CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'PAID', 'CANCELLED');

CREATE TABLE "invoices" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeMembershipId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CZK',
  "hourlyRate" DECIMAL(10,2) NOT NULL,
  "totalHours" DECIMAL(8,2) NOT NULL,
  "subtotal" DECIMAL(12,2) NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "sellerSnapshot" JSONB NOT NULL,
  "buyerSnapshot" JSONB NOT NULL,
  "sentAt" TIMESTAMP(3),
  "viewedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "invoice_items" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "workEntryId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "workDate" TIMESTAMP(3) NOT NULL,
  "hours" DECIMAL(5,2) NOT NULL,
  "hourlyRate" DECIMAL(10,2) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "invoices_companyId_invoiceNumber_key" ON "invoices"("companyId", "invoiceNumber");
CREATE INDEX "invoices_companyId_status_idx" ON "invoices"("companyId", "status");
CREATE INDEX "invoices_employeeMembershipId_periodStart_idx" ON "invoices"("employeeMembershipId", "periodStart");
CREATE UNIQUE INDEX "invoice_items_invoiceId_workEntryId_key" ON "invoice_items"("invoiceId", "workEntryId");
CREATE INDEX "invoice_items_workEntryId_idx" ON "invoice_items"("workEntryId");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_employeeMembershipId_fkey" FOREIGN KEY ("employeeMembershipId") REFERENCES "company_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_workEntryId_fkey" FOREIGN KEY ("workEntryId") REFERENCES "work_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;