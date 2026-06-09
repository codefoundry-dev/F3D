-- Case-insensitive alphabetical sort key for the materials catalogue.
--
-- `ORDER BY name` used the column's default (case-sensitive) collation, so a
-- mixed-case bulk-imported catalogue sorted uppercase-before-lowercase and read
-- as non-alphabetical. `name_ci` = lower(name), maintained automatically by
-- Postgres as a STORED generated column, lets `ORDER BY name_ci` be a true
-- case-insensitive A->Z. It is never written by the application (omitted from
-- every insert/update), so the existing catalogue-import upsert is unaffected.
ALTER TABLE "materials"
  ADD COLUMN "name_ci" TEXT GENERATED ALWAYS AS (lower("name")) STORED;

-- Index supporting the default catalogue ordering.
CREATE INDEX "idx_materials_name_ci" ON "materials" ("name_ci");
