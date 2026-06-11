-- US 5.01: Project Bill of Materials.
-- A BOM is created from a reviewed BOM doc extraction and linked to a project.
-- The newest BOM per project is ACTIVE; previous ones become SUPERSEDED and
-- surface under "Historical BOM versions" in the project BOM tab.

CREATE TYPE "BomStatus" AS ENUM ('ACTIVE', 'SUPERSEDED');

CREATE TABLE "boms" (
    "id" TEXT NOT NULL,
    "bom_number" VARCHAR(50) NOT NULL,
    "company_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "status" "BomStatus" NOT NULL DEFAULT 'ACTIVE',
    "extraction_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bom_items" (
    "id" TEXT NOT NULL,
    "bom_id" TEXT NOT NULL,
    "material_name" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "uom" VARCHAR(50),
    "quantity" DECIMAL(18,4),
    "category" VARCHAR(255),
    "material_type" VARCHAR(255),
    "matched_material_id" TEXT NOT NULL,
    "match_confidence" DOUBLE PRECISION,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bom_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idx_boms_company_number" ON "boms"("company_id", "bom_number");
CREATE INDEX "idx_boms_project_status" ON "boms"("project_id", "status");
CREATE INDEX "idx_boms_company" ON "boms"("company_id");
CREATE INDEX "idx_bom_items_bom" ON "bom_items"("bom_id");
CREATE INDEX "idx_bom_items_material" ON "bom_items"("matched_material_id");

ALTER TABLE "boms" ADD CONSTRAINT "boms_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "boms" ADD CONSTRAINT "boms_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "boms" ADD CONSTRAINT "boms_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_matched_material_id_fkey" FOREIGN KEY ("matched_material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
