-- US 4.01 Phase 3: Material change requests.
--
-- A Company-Admin / Procurement-Officer edit of a PUBLIC catalogue material is
-- captured as a PENDING change request (an approval queue) instead of mutating
-- the live row. The catalogue Super-Admin approves (applies the diff) or rejects
-- (discards) it. Mirrors po_change_requests.
--
-- Hand-written + idempotent (see prisma-migrate-headless): safe to re-run and
-- tolerant of partial application.

DO $$ BEGIN
  CREATE TYPE "MaterialChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "material_change_requests" (
  "id"               TEXT NOT NULL,
  "material_id"      TEXT NOT NULL,
  "changed_fields"   JSONB NOT NULL,
  "status"           "MaterialChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason"           TEXT,
  "requested_by_id"  TEXT NOT NULL,
  "resolved_by_id"   TEXT,
  "resolved_at"      TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "material_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_material_change_requests_material"
  ON "material_change_requests" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_material_change_requests_status"
  ON "material_change_requests" ("status");

DO $$ BEGIN
  ALTER TABLE "material_change_requests"
    ADD CONSTRAINT "material_change_requests_material_id_fkey"
    FOREIGN KEY ("material_id") REFERENCES "materials" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "material_change_requests"
    ADD CONSTRAINT "material_change_requests_requested_by_id_fkey"
    FOREIGN KEY ("requested_by_id") REFERENCES "users" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "material_change_requests"
    ADD CONSTRAINT "material_change_requests_resolved_by_id_fkey"
    FOREIGN KEY ("resolved_by_id") REFERENCES "users" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
