-- Second half of the PRIVATE material status change (see 20260726150000).

-- Every company-owned pending row was a private company catalogue row all along
-- — it was only PENDING_APPROVAL because the old upload path queued it for
-- Super-Admin publication. Reclassify those; rows with no owning company
-- (company_id NULL) are genuine Super-Admin drafts awaiting publication and keep
-- their PENDING_APPROVAL state.
UPDATE "materials"
SET "status" = 'PRIVATE'
WHERE "status" = 'PENDING_APPROVAL'
  AND "company_id" IS NOT NULL;

-- New rows are private unless explicitly published.
ALTER TABLE "materials" ALTER COLUMN "status" SET DEFAULT 'PRIVATE';

-- A catalogue upload now lands in a material list named after the uploaded file.
-- The extraction id marks the list as upload-derived and lets a re-import of the
-- same extraction top up that list instead of creating a duplicate.
ALTER TABLE "material_lists" ADD COLUMN IF NOT EXISTS "source_extraction_id" TEXT;

CREATE INDEX IF NOT EXISTS "idx_material_lists_source_extraction"
  ON "material_lists" ("source_extraction_id");
