-- FOR-210: PO form multi-delivery support

-- CreateTable: header-level delivery rows for a purchase order
CREATE TABLE "po_deliveries" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "delivery_location_id" TEXT,
    "delivery_date" TIMESTAMP(3),
    "notes" TEXT,
    "sequence" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "po_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_po_deliveries_po" ON "po_deliveries"("purchase_order_id");

-- AddForeignKey
ALTER TABLE "po_deliveries" ADD CONSTRAINT "po_deliveries_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_deliveries" ADD CONSTRAINT "po_deliveries_delivery_location_id_fkey" FOREIGN KEY ("delivery_location_id") REFERENCES "project_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
