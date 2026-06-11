-- US 4.01: Material Catalogue Management — rich material attributes.
--
-- Hand-written (NOT `prisma migrate dev`) to avoid clobbering the STORED
-- generated `name_ci` column (see 20260609100000_materials_name_ci_sort).
-- Every statement is idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF
-- NOT EXISTS) so it is safe to re-run and tolerant of partial application.

ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "material_type" VARCHAR(100);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "item_type" VARCHAR(100);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "country_of_origin" VARCHAR(100);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "manufacturer_series_model" VARCHAR(255);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "grade_class" VARCHAR(100);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "standard_norm" VARCHAR(100);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "colour_finish" VARCHAR(100);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "size" VARCHAR(100);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "price_per_unit" DECIMAL(18, 4);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) NOT NULL DEFAULT 'AUD';
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "dimensions" JSONB;
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "properties" JSONB;

-- Facet-filter indexes (catalogue list filters on material type / item type).
CREATE INDEX IF NOT EXISTS "idx_materials_material_type" ON "materials" ("material_type");
CREATE INDEX IF NOT EXISTS "idx_materials_item_type" ON "materials" ("item_type");
