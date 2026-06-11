-- US 5.05: Material lists.
-- A material list is a reusable, company-scoped collection of catalogue
-- materials (with per-item quantities) that buyers pick from during RFQ
-- creation to pre-fill line items.

CREATE TABLE "material_lists" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "company_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_lists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "material_list_items" (
    "id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_list_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_material_lists_company" ON "material_lists"("company_id");
CREATE UNIQUE INDEX "idx_material_list_items_list_material" ON "material_list_items"("list_id", "material_id");

ALTER TABLE "material_lists" ADD CONSTRAINT "material_lists_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_lists" ADD CONSTRAINT "material_lists_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_list_items" ADD CONSTRAINT "material_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "material_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "material_list_items" ADD CONSTRAINT "material_list_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
