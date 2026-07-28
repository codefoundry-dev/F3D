-- Invoice reconciliation accounting data (FOR-295): cost code + GL account per
-- invoice line, set by the reviewer so the data is export-ready for a later
-- accounting-system posting. No QuickBooks posting this phase.
ALTER TABLE "invoice_line_items" ADD COLUMN "cost_code" VARCHAR(64);
ALTER TABLE "invoice_line_items" ADD COLUMN "gl_account" VARCHAR(64);
