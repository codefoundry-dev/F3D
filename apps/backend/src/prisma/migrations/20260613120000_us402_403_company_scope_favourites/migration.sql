-- US 4.02 / 4.03: company-private materials + per-user favourites.
--
-- US 4.02 — materials.company_id: a Company-Admin / Procurement-Officer can
-- contribute a company-private material. NULL company_id ⇒ a PUBLIC, shared
-- catalogue row (the existing behaviour); a non-null company_id scopes the row
-- to that company until it is approved (promoted to PUBLIC, company_id → NULL).
-- Existing rows keep company_id = NULL, so nothing changes for them — no backfill.
--
-- US 4.03 — material_favourites: a per-user "saved" flag on a catalogue
-- material. The (user_id, material_id) unique makes favouriting idempotent.
--
-- Hand-written + idempotent (see prisma-migrate-headless): safe to re-run and
-- tolerant of partial application. Do NOT `prisma migrate dev` — it would
-- recreate the materials.name_ci STORED generated column as a plain column.

-- ── US 4.02: materials.company_id ──────────────────────────────────────────
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "company_id" TEXT;

CREATE INDEX IF NOT EXISTS "idx_materials_company"
  ON "materials" ("company_id");

DO $$ BEGIN
  ALTER TABLE "materials"
    ADD CONSTRAINT "materials_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── US 4.03: material_favourites ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "material_favourites" (
  "id"          TEXT NOT NULL,
  "user_id"     TEXT NOT NULL,
  "material_id" TEXT NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "material_favourites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_material_favourites_user_material"
  ON "material_favourites" ("user_id", "material_id");
CREATE INDEX IF NOT EXISTS "idx_material_favourites_material"
  ON "material_favourites" ("material_id");

DO $$ BEGIN
  ALTER TABLE "material_favourites"
    ADD CONSTRAINT "material_favourites_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "material_favourites"
    ADD CONSTRAINT "material_favourites_material_id_fkey"
    FOREIGN KEY ("material_id") REFERENCES "materials" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
