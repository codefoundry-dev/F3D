-- Add Cost Code + Tax Code to the material catalogue, and snapshot UPC /
-- Manufacturer Part Number / Tax Code onto RFQ & PO line items (Cost Code
-- already exists on both line-item tables and now pre-fills from the material).
--
-- Hand-written (NOT `prisma migrate dev`) to preserve the STORED generated
-- `materials.name_ci` column (see 20260609100000_materials_name_ci_sort). Every
-- statement is idempotent (ADD COLUMN IF NOT EXISTS) so it is safe to re-run.

-- Material catalogue: accounting codes carried by every line referencing it.
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "cost_code" VARCHAR(100);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "tax_code" VARCHAR(100);

-- RFQ line items: snapshot fields copied from the material at create.
ALTER TABLE "rfq_line_items" ADD COLUMN IF NOT EXISTS "upc" VARCHAR(100);
ALTER TABLE "rfq_line_items" ADD COLUMN IF NOT EXISTS "manufacturer_part_number" VARCHAR(255);
ALTER TABLE "rfq_line_items" ADD COLUMN IF NOT EXISTS "tax_code" VARCHAR(100);

-- PO line items: same snapshot fields.
ALTER TABLE "po_line_items" ADD COLUMN IF NOT EXISTS "upc" VARCHAR(100);
ALTER TABLE "po_line_items" ADD COLUMN IF NOT EXISTS "manufacturer_part_number" VARCHAR(255);
ALTER TABLE "po_line_items" ADD COLUMN IF NOT EXISTS "tax_code" VARCHAR(100);
