-- FOR-362: editable material categories — Super Admin can rename and deactivate.
-- Existing categories stay active; deactivated ones remain on their materials.
ALTER TABLE "material_categories" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "material_categories" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
