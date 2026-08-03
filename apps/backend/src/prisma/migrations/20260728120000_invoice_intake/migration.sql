-- Invoice intake (FOR-290): invoices can now be created at intake time — manual
-- upload by the buyer team or arrival on the company's invoice-intake email
-- inbox — before review (FOR-291) has identified the project, vendor, or
-- amount. Those columns therefore become nullable; approve refuses invoices
-- where they still are.

ALTER TABLE "invoices" ALTER COLUMN "project_id" DROP NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "vendor_id" DROP NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "created_by_user_id" DROP NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "total_amount" DROP NOT NULL;

-- How the invoice entered the system.
CREATE TYPE "InvoiceSource" AS ENUM ('MANUAL', 'EMAIL');
ALTER TABLE "invoices" ADD COLUMN "source" "InvoiceSource" NOT NULL DEFAULT 'MANUAL';

-- Email-intake provenance: sending address + provider received-email id (the
-- idempotency key that keeps webhook retries from duplicating invoices).
ALTER TABLE "invoices" ADD COLUMN "sender_email" VARCHAR(255);
ALTER TABLE "invoices" ADD COLUMN "intake_email_id" VARCHAR(255);
CREATE INDEX "idx_invoices_intake_email" ON "invoices"("intake_email_id");

-- Per-company invoice-intake inbox key: invoices-<key>@INVOICE_INBOUND_DOMAIN.
ALTER TABLE "companies" ADD COLUMN "invoice_inbox_key" VARCHAR(32);
CREATE UNIQUE INDEX "companies_invoice_inbox_key_key" ON "companies"("invoice_inbox_key");

-- Files that arrive by email have no uploading user.
ALTER TABLE "files" ALTER COLUMN "uploaded_by_id" DROP NOT NULL;
