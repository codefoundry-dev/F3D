-- US 5.19 (split parent/child POs): persist the per-vendor approved quantity on
-- each quote line so a multi-vendor award is durable and auditable. Null until
-- the line is awarded; on award it is set to the quantity granted to that vendor
-- (1..quoted_quantity), with the sum across vendors for one RFQ line kept ≤ the
-- RFQ requested quantity. Backward-compatible: existing rows stay null.

-- AlterTable
ALTER TABLE "quote_response_line_items" ADD COLUMN "approved_quantity" INTEGER;
