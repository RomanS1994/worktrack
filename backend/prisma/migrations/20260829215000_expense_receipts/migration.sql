ALTER TABLE "company_expenses"
ADD COLUMN "receiptData" BYTEA,
ADD COLUMN "receiptMimeType" TEXT,
ADD COLUMN "receiptFileName" TEXT;
