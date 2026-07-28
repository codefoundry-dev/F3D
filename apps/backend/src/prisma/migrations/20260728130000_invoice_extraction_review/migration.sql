-- Invoice extraction + review (FOR-291): intake invoices get an automatic
-- Gemini extraction whose result a human confirms/corrects; the confirmed
-- fields persist on the invoice record.

-- Extracted-then-reviewed header fields: the vendor's own invoice number and
-- issue date, plus the reviewer stamp.
ALTER TABLE "invoices" ADD COLUMN "invoice_number" VARCHAR(100);
ALTER TABLE "invoices" ADD COLUMN "issued_date" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN "reviewed_by_user_id" TEXT;
ALTER TABLE "invoices" ADD COLUMN "reviewed_at" TIMESTAMP(3);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The invoice's billed lines as confirmed at review. Seeded from the Gemini
-- extraction, corrected by the reviewer; each review save replaces the set.
CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "line_id" VARCHAR(64),
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4),
    "unit" VARCHAR(32),
    "unit_price" DECIMAL(18,4),
    "line_total" DECIMAL(18,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_invoice_line_items_invoice" ON "invoice_line_items"("invoice_id");
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Link an extraction back to the intake invoice it was run for (plain scalar,
-- mirroring rfq_id), and allow user-less extractions: email-intake invoices
-- have no creating user.
ALTER TABLE "doc_extractions" ADD COLUMN "invoice_id" TEXT;
CREATE INDEX "idx_doc_extractions_invoice" ON "doc_extractions"("invoice_id");
ALTER TABLE "doc_extractions" ALTER COLUMN "created_by_user_id" DROP NOT NULL;
