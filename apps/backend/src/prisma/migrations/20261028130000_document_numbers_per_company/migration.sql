-- Document numbers (MR-, RFQ-, PO-, BULK-) are sequenced PER COMPANY, but each
-- number column was globally unique, so the first document of every company
-- after the first collided with another company's number (P2002 -> HTTP 500).
-- Scope uniqueness to the company, matching boms (idx_boms_company_number) and
-- delivery_reports (20261028120000).
DROP INDEX IF EXISTS "material_requests_mr_number_key";
CREATE UNIQUE INDEX IF NOT EXISTS "uq_material_requests_company_mr_number"
  ON "material_requests" ("company_id", "mr_number");

DROP INDEX IF EXISTS "rfqs_rfq_number_key";
CREATE UNIQUE INDEX IF NOT EXISTS "uq_rfqs_company_rfq_number"
  ON "rfqs" ("company_id", "rfq_number");

DROP INDEX IF EXISTS "purchase_orders_po_number_key";
CREATE UNIQUE INDEX IF NOT EXISTS "uq_purchase_orders_company_po_number"
  ON "purchase_orders" ("company_id", "po_number");

DROP INDEX IF EXISTS "bulk_orders_bulk_order_number_key";
CREATE UNIQUE INDEX IF NOT EXISTS "uq_bulk_orders_company_bulk_order_number"
  ON "bulk_orders" ("company_id", "bulk_order_number");
