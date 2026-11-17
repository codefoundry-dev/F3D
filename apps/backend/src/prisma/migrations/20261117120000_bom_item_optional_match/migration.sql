-- A BOM line may be saved without a catalogue match (matched later from
-- Edit BOM). The foreign key and its ON DELETE RESTRICT are unchanged.
ALTER TABLE "bom_items" ALTER COLUMN "matched_material_id" DROP NOT NULL;
