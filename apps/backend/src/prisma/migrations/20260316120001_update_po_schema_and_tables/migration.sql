-- Migrate existing PENDING_DELIVERY rows to new enum value
UPDATE "purchase_orders" SET "status" = 'SCHEDULED_FOR_DELIVERY' WHERE "status" = 'PENDING_DELIVERY';

-- Migrate existing BULK_DRAWDOWN rows to new enum value
UPDATE "purchase_orders" SET "po_type" = 'BULK' WHERE "po_type" = 'BULK_DRAWDOWN';

-- AlterTable: Add new columns to purchase_orders
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "po_number" VARCHAR(50);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "rfq_id" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "parent_po_id" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "source_of_creation" "PoSourceOfCreation" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "hold_for_release" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "planned_delivery_date" TIMESTAMP(3);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "delivery_notes" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) NOT NULL DEFAULT 'AUD';
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(18,4);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(18,4);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "tax_amount" DECIMAL(18,4);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "payment_term" "PaymentTerm";
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "cost_code" VARCHAR(100);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "total_requested_qty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "issued_at" TIMESTAMP(3);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "last_modified_by_id" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "priority" "PoPriority";

-- Backfill po_number from id prefix for existing rows
UPDATE "purchase_orders" SET "po_number" = 'PO-' || UPPER(SUBSTRING(id, 1, 8))
  WHERE "po_number" IS NULL;

-- Make po_number NOT NULL and UNIQUE after backfill
ALTER TABLE "purchase_orders" ALTER COLUMN "po_number" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_po_number_key" ON "purchase_orders"("po_number");

-- Convert approval_status from text to enum
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "approval_status";
ALTER TABLE "purchase_orders" ADD COLUMN "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_pos_parent" ON "purchase_orders"("parent_po_id");
CREATE INDEX IF NOT EXISTS "idx_pos_rfq" ON "purchase_orders"("rfq_id");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_parent_po_id_fkey" FOREIGN KEY ("parent_po_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_last_modified_by_id_fkey" FOREIGN KEY ("last_modified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: po_line_items
CREATE TABLE IF NOT EXISTS "po_line_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "material_name" TEXT NOT NULL,
    "material_code" VARCHAR(100),
    "description" TEXT,
    "quantity_ordered" INTEGER NOT NULL,
    "quantity_delivered" INTEGER NOT NULL DEFAULT 0,
    "unit_of_measure" VARCHAR(50) NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "line_total" DECIMAL(18,4) NOT NULL,
    "cost_code" VARCHAR(100),
    "expected_delivery_date" TIMESTAMP(3),
    "delivery_location" TEXT,
    "notes" TEXT,

    CONSTRAINT "po_line_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_po_line_items_po" ON "po_line_items"("purchase_order_id");

ALTER TABLE "po_line_items" ADD CONSTRAINT "po_line_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: po_documents
CREATE TABLE IF NOT EXISTS "po_documents" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "po_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_po_documents_po" ON "po_documents"("purchase_order_id");

ALTER TABLE "po_documents" ADD CONSTRAINT "po_documents_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "po_documents" ADD CONSTRAINT "po_documents_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: po_change_requests
CREATE TABLE IF NOT EXISTS "po_change_requests" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "change_type" "PoChangeType" NOT NULL,
    "changed_fields" JSONB NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "po_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_po_change_requests_po" ON "po_change_requests"("purchase_order_id");

ALTER TABLE "po_change_requests" ADD CONSTRAINT "po_change_requests_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "po_change_requests" ADD CONSTRAINT "po_change_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "po_change_requests" ADD CONSTRAINT "po_change_requests_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
