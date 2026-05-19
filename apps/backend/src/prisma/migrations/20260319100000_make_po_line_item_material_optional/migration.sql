-- AlterTable
ALTER TABLE "po_line_items" ALTER COLUMN "material_id" DROP NOT NULL;

-- DropForeignKey (recreate as optional)
ALTER TABLE "po_line_items" DROP CONSTRAINT IF EXISTS "po_line_items_material_id_fkey";

-- AddForeignKey
ALTER TABLE "po_line_items" ADD CONSTRAINT "po_line_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
