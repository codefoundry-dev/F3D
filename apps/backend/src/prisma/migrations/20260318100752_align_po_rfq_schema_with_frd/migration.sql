/*
  Warnings:

  - The values [PENDING_DELIVERY] on the enum `PoStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [BULK_DRAWDOWN] on the enum `PoType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `delivery_location` on the `po_line_items` table. All the data in the column will be lost.
  - You are about to drop the column `material_name` on the `po_line_items` table. All the data in the column will be lost.
  - You are about to drop the column `delivery_location` on the `purchase_orders` table. All the data in the column will be lost.
  - You are about to drop the column `payment_term` on the `purchase_orders` table. All the data in the column will be lost.
  - You are about to drop the column `material_name` on the `rfq_line_items` table. All the data in the column will be lost.
  - You are about to drop the column `delivery_location` on the `rfqs` table. All the data in the column will be lost.
  - The `approval_status` column on the `rfqs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[rfq_number]` on the table `rfqs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `material_id` to the `po_line_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `material_id` to the `rfq_line_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rfq_number` to the `rfqs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('PUBLIC', 'PENDING_APPROVAL', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PickUpTimeExpectation" AS ENUM ('ASAP', 'TOMORROW', 'CUSTOM_DATE');

-- AlterEnum
BEGIN;
CREATE TYPE "PoStatus_new" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'ACCEPTED', 'DECLINED', 'SCHEDULED_FOR_DELIVERY', 'CANCELLED', 'CLOSED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'LATE_FOR_DELIVERY', 'CANCELLED_BY_VENDOR', 'INVOICED', 'DISPUTE', 'NOT_DELIVERED', 'CHANGE_PENDING');
ALTER TABLE "purchase_orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "purchase_orders" ALTER COLUMN "status" TYPE "PoStatus_new" USING ("status"::text::"PoStatus_new");
ALTER TYPE "PoStatus" RENAME TO "PoStatus_old";
ALTER TYPE "PoStatus_new" RENAME TO "PoStatus";
DROP TYPE "PoStatus_old";
ALTER TABLE "purchase_orders" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PoType_new" AS ENUM ('STANDARD', 'BULK', 'HOLD_FOR_RELEASE', 'DRAWDOWN', 'SPLIT');
ALTER TABLE "purchase_orders" ALTER COLUMN "po_type" DROP DEFAULT;
ALTER TABLE "purchase_orders" ALTER COLUMN "po_type" TYPE "PoType_new" USING ("po_type"::text::"PoType_new");
ALTER TYPE "PoType" RENAME TO "PoType_old";
ALTER TYPE "PoType_new" RENAME TO "PoType";
DROP TYPE "PoType_old";
ALTER TABLE "purchase_orders" ALTER COLUMN "po_type" SET DEFAULT 'STANDARD';
COMMIT;

-- AlterTable
ALTER TABLE "po_line_items" DROP COLUMN "delivery_location",
DROP COLUMN "material_name",
ADD COLUMN     "delivery_location_id" TEXT,
ADD COLUMN     "material_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "purchase_orders" DROP COLUMN "delivery_location",
DROP COLUMN "payment_term",
ADD COLUMN     "delivery_location_id" TEXT,
ADD COLUMN     "delivery_responsible_email" TEXT,
ADD COLUMN     "delivery_responsible_name" TEXT,
ADD COLUMN     "message" TEXT,
ADD COLUMN     "payment_terms_days" INTEGER,
ADD COLUMN     "pick_up_person_name" TEXT,
ADD COLUMN     "pick_up_person_phone" TEXT,
ADD COLUMN     "pick_up_time_expectation" "PickUpTimeExpectation";

-- AlterTable
ALTER TABLE "rfq_line_items" DROP COLUMN "material_name",
ADD COLUMN     "cost_code" VARCHAR(100),
ADD COLUMN     "material_id" TEXT NOT NULL,
ADD COLUMN     "pick_up" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "rfqs" DROP COLUMN "delivery_location",
ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'AUD',
ADD COLUMN     "delivery_location_id" TEXT,
ADD COLUMN     "earliest_delivery_date" TIMESTAMP(3),
ADD COLUMN     "hold_for_release" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "message" TEXT,
ADD COLUMN     "need_by_date" TIMESTAMP(3),
ADD COLUMN     "rfq_number" VARCHAR(50) NOT NULL,
DROP COLUMN "approval_status",
ADD COLUMN     "approval_status" "ApprovalStatus";

-- DropEnum
DROP TYPE "PaymentTerm";

-- CreateTable
CREATE TABLE "material_categories" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category_id" TEXT NOT NULL,
    "uom" VARCHAR(50) NOT NULL,
    "upc" VARCHAR(100),
    "manufacturer" VARCHAR(255),
    "description" TEXT,
    "status" "MaterialStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_vendors" (
    "id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfq_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_categories_name_key" ON "material_categories"("name");

-- CreateIndex
CREATE INDEX "idx_materials_category" ON "materials"("category_id");

-- CreateIndex
CREATE INDEX "idx_materials_status" ON "materials"("status");

-- CreateIndex
CREATE INDEX "idx_materials_name" ON "materials"("name");

-- CreateIndex
CREATE UNIQUE INDEX "idx_material_name_status" ON "materials"("name", "status");

-- CreateIndex
CREATE INDEX "idx_rfq_vendors_rfq" ON "rfq_vendors"("rfq_id");

-- CreateIndex
CREATE INDEX "idx_rfq_vendors_vendor" ON "rfq_vendors"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_rfq_vendor_unique" ON "rfq_vendors"("rfq_id", "vendor_id");

-- CreateIndex
CREATE INDEX "idx_po_line_items_material" ON "po_line_items"("material_id");

-- CreateIndex
CREATE INDEX "idx_pos_delivery_location" ON "purchase_orders"("delivery_location_id");

-- CreateIndex
CREATE INDEX "idx_rfq_line_items_material" ON "rfq_line_items"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "rfqs_rfq_number_key" ON "rfqs"("rfq_number");

-- CreateIndex
CREATE INDEX "idx_rfqs_delivery_location" ON "rfqs"("delivery_location_id");

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "material_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_delivery_location_id_fkey" FOREIGN KEY ("delivery_location_id") REFERENCES "project_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_line_items" ADD CONSTRAINT "po_line_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_line_items" ADD CONSTRAINT "po_line_items_delivery_location_id_fkey" FOREIGN KEY ("delivery_location_id") REFERENCES "project_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_delivery_location_id_fkey" FOREIGN KEY ("delivery_location_id") REFERENCES "project_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_vendors" ADD CONSTRAINT "rfq_vendors_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_vendors" ADD CONSTRAINT "rfq_vendors_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_line_items" ADD CONSTRAINT "rfq_line_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
