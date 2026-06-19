-- US 4.04: Per-user material usage signal.
-- A lightweight (user, material) counter bumped whenever a user "uses" a
-- material (adds it to a material list, or references it on a created BOM line).
-- Backs the catalogue search autocomplete's "Recently used" (by last_used_at)
-- and "Frequently used" (by use_count) groups. The (user_id, material_id)
-- unique makes the bump an idempotent upsert per user+material.

CREATE TABLE "material_usage" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "use_count" INTEGER NOT NULL DEFAULT 1,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idx_material_usage_user_material" ON "material_usage"("user_id", "material_id");
CREATE INDEX "idx_material_usage_user_recent" ON "material_usage"("user_id", "last_used_at");
CREATE INDEX "idx_material_usage_user_frequent" ON "material_usage"("user_id", "use_count");
CREATE INDEX "idx_material_usage_material" ON "material_usage"("material_id");

ALTER TABLE "material_usage" ADD CONSTRAINT "material_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "material_usage" ADD CONSTRAINT "material_usage_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
