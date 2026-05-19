-- AlterTable: add document_name to purchase_orders
ALTER TABLE "purchase_orders" ADD COLUMN "document_name" VARCHAR(255);

-- AlterTable: add pick_up flag to po_line_items
ALTER TABLE "po_line_items" ADD COLUMN "pick_up" BOOLEAN NOT NULL DEFAULT false;
