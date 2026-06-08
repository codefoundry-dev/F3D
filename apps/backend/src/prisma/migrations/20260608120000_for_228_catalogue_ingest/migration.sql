-- FOR-228: Catalogue ingest
-- Drop the (name, status) unique constraint — catalogue product names are NOT
-- unique (verified: up to 28 duplicates in the Rexel catalogue). SKU becomes the
-- natural unique key instead. The plain name index is preserved separately.
DROP INDEX "idx_material_name_status";

-- New catalogue columns on materials.
ALTER TABLE "materials" ADD COLUMN "sku" VARCHAR(100);
ALTER TABLE "materials" ADD COLUMN "brand" VARCHAR(255);
ALTER TABLE "materials" ADD COLUMN "manufacturer_part_number" VARCHAR(255);
ALTER TABLE "materials" ADD COLUMN "sub_category" VARCHAR(255);
ALTER TABLE "materials" ADD COLUMN "image_url" TEXT;

-- SKU is the natural unique key for bulk catalogue upserts (ON CONFLICT (sku)).
CREATE UNIQUE INDEX "idx_material_sku" ON "materials"("sku");

-- New extraction type for catalogue ingest (spreadsheet = direct parse, PDF = LLM).
ALTER TYPE "DocExtractionType" ADD VALUE 'CATALOGUE';
