-- Material Request (MR) module — Epic 6.
--
-- An internal request to procure materials, upstream of RFQ. Creates the MR
-- lifecycle/priority enums, the material_requests + material_request_line_items
-- tables (mirroring rfqs + rfq_line_items), and the MR-lifecycle AuditAction
-- enum values used by the now-audited MR status transitions
-- (create/submit/approve/decline/cancel/convert).
--
-- Hand-written + idempotent (see prisma-migrate-headless): safe to re-run and
-- tolerant of partial application. Do NOT `prisma migrate dev` here — the shell
-- is non-interactive; run `prisma migrate deploy` instead. Dev Postgres is on
-- port 5433.

-- ── 1) MR lifecycle / priority enums ─────────────────────────────────────────
-- Guarded so a re-run is a no-op (CREATE TYPE has no IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaterialRequestStatus') THEN
    CREATE TYPE "MaterialRequestStatus" AS ENUM (
      'DRAFT', 'SUBMITTED', 'APPROVED', 'CONVERTED', 'DECLINED', 'CANCELLED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaterialRequestPriority') THEN
    CREATE TYPE "MaterialRequestPriority" AS ENUM (
      'LOW', 'MEDIUM', 'HIGH', 'URGENT'
    );
  END IF;
END
$$;

-- ── 2) MR lifecycle audit actions ────────────────────────────────────────────
-- ALTER TYPE … ADD VALUE cannot run inside a transaction block in older
-- Postgres; "IF NOT EXISTS" makes each statement a safe no-op on re-run. Mirrors
-- the PO slice migration (20260615120000_po_state_audit).
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MATERIAL_REQUEST_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MATERIAL_REQUEST_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MATERIAL_REQUEST_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MATERIAL_REQUEST_DECLINED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MATERIAL_REQUEST_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MATERIAL_REQUEST_CONVERTED';

-- ── 3) material_requests table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "material_requests" (
  "id"                   TEXT NOT NULL,
  "mr_number"            VARCHAR(50) NOT NULL,
  "project_id"           TEXT NOT NULL,
  "company_id"           TEXT NOT NULL,
  "status"               "MaterialRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "priority"             "MaterialRequestPriority" NOT NULL DEFAULT 'MEDIUM',
  "requested_by_id"      TEXT NOT NULL,
  "needed_by_date"       TIMESTAMP(3),
  "delivery_location_id" TEXT,
  "note"                 TEXT,
  "reviewed_by_id"       TEXT,
  "reviewed_at"          TIMESTAMP(3),
  "decline_reason"       TEXT,
  "converted_to_rfq_id"  TEXT,
  "converted_to_po_id"   TEXT,
  "converted_at"         TIMESTAMP(3),
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "material_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "material_requests_mr_number_key"
  ON "material_requests" ("mr_number");
CREATE INDEX IF NOT EXISTS "idx_material_requests_company"
  ON "material_requests" ("company_id");
CREATE INDEX IF NOT EXISTS "idx_material_requests_project"
  ON "material_requests" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_material_requests_status"
  ON "material_requests" ("status");
CREATE INDEX IF NOT EXISTS "idx_material_requests_requested_by"
  ON "material_requests" ("requested_by_id");

-- ── 4) material_request_line_items table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS "material_request_line_items" (
  "id"                     TEXT NOT NULL,
  "material_request_id"    TEXT NOT NULL,
  "material_id"            TEXT,
  "material_name"          VARCHAR(255),
  "description"            TEXT,
  "quantity"               INTEGER NOT NULL,
  "unit"                   VARCHAR(50) NOT NULL,
  "priority"               "MaterialRequestPriority",
  "expected_delivery_date" TIMESTAMP(3),
  "delivery_location_id"   TEXT,
  "notes"                  TEXT,
  CONSTRAINT "material_request_line_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_material_request_line_items_mr"
  ON "material_request_line_items" ("material_request_id");
CREATE INDEX IF NOT EXISTS "idx_material_request_line_items_material"
  ON "material_request_line_items" ("material_id");

-- ── 5) Foreign keys ──────────────────────────────────────────────────────────
-- Guarded with a catalog check since ADD CONSTRAINT has no IF NOT EXISTS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_requests_project_id_fkey') THEN
    ALTER TABLE "material_requests"
      ADD CONSTRAINT "material_requests_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_requests_company_id_fkey') THEN
    ALTER TABLE "material_requests"
      ADD CONSTRAINT "material_requests_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_requests_requested_by_id_fkey') THEN
    ALTER TABLE "material_requests"
      ADD CONSTRAINT "material_requests_requested_by_id_fkey"
      FOREIGN KEY ("requested_by_id") REFERENCES "users" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_requests_reviewed_by_id_fkey') THEN
    ALTER TABLE "material_requests"
      ADD CONSTRAINT "material_requests_reviewed_by_id_fkey"
      FOREIGN KEY ("reviewed_by_id") REFERENCES "users" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_requests_delivery_location_id_fkey') THEN
    ALTER TABLE "material_requests"
      ADD CONSTRAINT "material_requests_delivery_location_id_fkey"
      FOREIGN KEY ("delivery_location_id") REFERENCES "project_locations" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_requests_converted_to_rfq_id_fkey') THEN
    ALTER TABLE "material_requests"
      ADD CONSTRAINT "material_requests_converted_to_rfq_id_fkey"
      FOREIGN KEY ("converted_to_rfq_id") REFERENCES "rfqs" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_requests_converted_to_po_id_fkey') THEN
    ALTER TABLE "material_requests"
      ADD CONSTRAINT "material_requests_converted_to_po_id_fkey"
      FOREIGN KEY ("converted_to_po_id") REFERENCES "purchase_orders" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_request_line_items_material_request_id_fkey') THEN
    ALTER TABLE "material_request_line_items"
      ADD CONSTRAINT "material_request_line_items_material_request_id_fkey"
      FOREIGN KEY ("material_request_id") REFERENCES "material_requests" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_request_line_items_material_id_fkey') THEN
    ALTER TABLE "material_request_line_items"
      ADD CONSTRAINT "material_request_line_items_material_id_fkey"
      FOREIGN KEY ("material_id") REFERENCES "materials" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_request_line_items_delivery_location_id_fkey') THEN
    ALTER TABLE "material_request_line_items"
      ADD CONSTRAINT "material_request_line_items_delivery_location_id_fkey"
      FOREIGN KEY ("delivery_location_id") REFERENCES "project_locations" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
