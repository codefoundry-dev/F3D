-- FOR-204: allow RFQ line items to come from a catalog material OR a parsed BOM.
-- BOM-sourced lines have no catalog material, so material_id becomes nullable and
-- a free-text material_name column is added to carry the parsed name.
ALTER TABLE "rfq_line_items" ALTER COLUMN "material_id" DROP NOT NULL;
ALTER TABLE "rfq_line_items" ADD COLUMN "material_name" VARCHAR(255);
