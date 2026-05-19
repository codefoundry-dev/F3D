-- Add bulk_order_number to bulk_orders
ALTER TABLE "bulk_orders" ADD COLUMN "bulk_order_number" VARCHAR(50);
CREATE UNIQUE INDEX "bulk_orders_bulk_order_number_key" ON "bulk_orders"("bulk_order_number");

-- Backfill existing bulk orders with generated numbers
UPDATE "bulk_orders"
SET "bulk_order_number" = 'BULK-' || UPPER(SUBSTR(gen_random_uuid()::text, 1, 8))
WHERE "bulk_order_number" IS NULL;

-- Add line_item_id and qty_before_drawdown to drawdowns
ALTER TABLE "drawdowns" ADD COLUMN "line_item_id" TEXT;
ALTER TABLE "drawdowns" ADD COLUMN "qty_before_drawdown" INTEGER;

-- Add foreign key for drawdowns.line_item_id -> bulk_order_line_items.id
ALTER TABLE "drawdowns" ADD CONSTRAINT "drawdowns_line_item_id_fkey"
  FOREIGN KEY ("line_item_id") REFERENCES "bulk_order_line_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
