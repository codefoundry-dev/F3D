-- Epic 6 — Delivery. Delivery Reports + the public QR-portal access-code slot.
--
-- A Delivery Report records what physically arrived against a PO (created
-- SUBMITTED by internal staff or by an unauthenticated delivery person via the
-- QR portal; APPROVED flows received quantities to the PO lines + inventory,
-- REJECTED stores a reason and leaves the PO untouched). Adds:
--   • two AccessTokenPurpose values (DELIVERY_SUBMIT long-lived QR link,
--     DELIVERY_SESSION short-lived post-code-verify session),
--   • three AuditAction values (DELIVERY_REPORT_CREATED/APPROVED/REJECTED),
--   • five domain enums + five tables (delivery_reports, delivery_report_lines,
--     delivery_damage_photos, delivery_report_attachments, delivery_access_codes).
--
-- Hand-written + idempotent (see prisma-migrate-headless): safe to re-run and
-- tolerant of partial application. Do NOT `prisma migrate dev` here — the shell
-- is non-interactive; run `prisma migrate deploy` instead. Dev Postgres is on
-- port 5433. company_id on delivery_reports is a scalar FK column (no Prisma
-- relation field) — its constraint is added below.

-- ── 1) Enum value additions (guarded; ADD VALUE has IF NOT EXISTS) ────────────
ALTER TYPE "AccessTokenPurpose" ADD VALUE IF NOT EXISTS 'DELIVERY_SUBMIT';
ALTER TYPE "AccessTokenPurpose" ADD VALUE IF NOT EXISTS 'DELIVERY_SESSION';

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DELIVERY_REPORT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DELIVERY_REPORT_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DELIVERY_REPORT_REJECTED';

-- ── 2) Domain enums (guarded; CREATE TYPE has no IF NOT EXISTS) ───────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryReportStatus') THEN
    CREATE TYPE "DeliveryReportStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryReportSource') THEN
    CREATE TYPE "DeliveryReportSource" AS ENUM ('INTERNAL', 'EXTERNAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryOutcome') THEN
    CREATE TYPE "DeliveryOutcome" AS ENUM ('DELIVERED', 'PARTIALLY_DELIVERED', 'NOT_DELIVERED', 'DAMAGED', 'REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DamageType') THEN
    CREATE TYPE "DamageType" AS ENUM ('IN_TRANSIT', 'MANUFACTURING_DEFECT', 'PACKAGING', 'WATER', 'OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DamageDisposition') THEN
    CREATE TYPE "DamageDisposition" AS ENUM ('RETURNED', 'ACCEPTED');
  END IF;
END
$$;

-- ── 3) delivery_reports ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "delivery_reports" (
  "id"                   TEXT NOT NULL,
  "report_number"        VARCHAR(50) NOT NULL,
  "purchase_order_id"    TEXT NOT NULL,
  "company_id"           TEXT NOT NULL,
  "project_id"           TEXT,
  "status"               "DeliveryReportStatus" NOT NULL DEFAULT 'SUBMITTED',
  "source"               "DeliveryReportSource" NOT NULL,
  "delivery_date"        TIMESTAMP(3),
  "delivery_location_id" TEXT,
  "vendor_id"            TEXT,
  "overall_notes"        TEXT,
  "submitter_user_id"    TEXT,
  "submitter_name"       VARCHAR(255) NOT NULL,
  "submitter_email"      VARCHAR(255) NOT NULL,
  "contact_person"       VARCHAR(255),
  "contact_phone"        VARCHAR(50),
  "reviewed_by_user_id"  TEXT,
  "reviewed_at"          TIMESTAMP(3),
  "rejection_reason"     TEXT,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "delivery_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_reports_report_number_key"
  ON "delivery_reports" ("report_number");
CREATE INDEX IF NOT EXISTS "idx_delivery_reports_company"
  ON "delivery_reports" ("company_id");
CREATE INDEX IF NOT EXISTS "idx_delivery_reports_po"
  ON "delivery_reports" ("purchase_order_id");
CREATE INDEX IF NOT EXISTS "idx_delivery_reports_status"
  ON "delivery_reports" ("status");
CREATE INDEX IF NOT EXISTS "idx_delivery_reports_project"
  ON "delivery_reports" ("project_id");

-- ── 4) delivery_report_lines ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "delivery_report_lines" (
  "id"                 TEXT NOT NULL,
  "delivery_report_id" TEXT NOT NULL,
  "po_line_item_id"    TEXT NOT NULL,
  "material_id"        TEXT,
  "quantity_ordered"   INTEGER NOT NULL,
  "quantity_received"  INTEGER NOT NULL,
  "outcome"            "DeliveryOutcome" NOT NULL,
  "notes"              TEXT,
  "damaged_quantity"   INTEGER,
  "damage_type"        "DamageType",
  "damage_disposition" "DamageDisposition",
  CONSTRAINT "delivery_report_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_delivery_report_lines_report"
  ON "delivery_report_lines" ("delivery_report_id");
CREATE INDEX IF NOT EXISTS "idx_delivery_report_lines_po_line"
  ON "delivery_report_lines" ("po_line_item_id");

-- ── 5) delivery_damage_photos ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "delivery_damage_photos" (
  "id"                      TEXT NOT NULL,
  "delivery_report_line_id" TEXT NOT NULL,
  "file_id"                 TEXT NOT NULL,
  "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_damage_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_delivery_damage_photos_line"
  ON "delivery_damage_photos" ("delivery_report_line_id");

-- ── 6) delivery_report_attachments ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "delivery_report_attachments" (
  "id"                 TEXT NOT NULL,
  "delivery_report_id" TEXT NOT NULL,
  "file_id"            TEXT NOT NULL,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_report_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_delivery_report_attachments_report"
  ON "delivery_report_attachments" ("delivery_report_id");

-- ── 7) delivery_access_codes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "delivery_access_codes" (
  "id"                TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "email"             VARCHAR(255) NOT NULL,
  "codes"             JSONB NOT NULL DEFAULT '[]',
  "attempts"          INTEGER NOT NULL DEFAULT 0,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "delivery_access_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_delivery_access_codes_po_email"
  ON "delivery_access_codes" ("purchase_order_id", "email");
CREATE INDEX IF NOT EXISTS "idx_delivery_access_codes_po"
  ON "delivery_access_codes" ("purchase_order_id");

-- ── 8) Foreign keys (guarded; ADD CONSTRAINT has no IF NOT EXISTS) ────────────
-- company_id is a scalar FK (RESTRICT). PO / file parents that own the row
-- cascade on delete; lookup references (project, location, vendor, material,
-- submitter, reviewer) RESTRICT / SET NULL appropriately.
DO $$
BEGIN
  -- delivery_reports
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_reports_company_id_fkey') THEN
    ALTER TABLE "delivery_reports"
      ADD CONSTRAINT "delivery_reports_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_reports_purchase_order_id_fkey') THEN
    ALTER TABLE "delivery_reports"
      ADD CONSTRAINT "delivery_reports_purchase_order_id_fkey"
      FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_reports_project_id_fkey') THEN
    ALTER TABLE "delivery_reports"
      ADD CONSTRAINT "delivery_reports_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_reports_delivery_location_id_fkey') THEN
    ALTER TABLE "delivery_reports"
      ADD CONSTRAINT "delivery_reports_delivery_location_id_fkey"
      FOREIGN KEY ("delivery_location_id") REFERENCES "project_locations" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_reports_vendor_id_fkey') THEN
    ALTER TABLE "delivery_reports"
      ADD CONSTRAINT "delivery_reports_vendor_id_fkey"
      FOREIGN KEY ("vendor_id") REFERENCES "companies" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_reports_submitter_user_id_fkey') THEN
    ALTER TABLE "delivery_reports"
      ADD CONSTRAINT "delivery_reports_submitter_user_id_fkey"
      FOREIGN KEY ("submitter_user_id") REFERENCES "users" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_reports_reviewed_by_user_id_fkey') THEN
    ALTER TABLE "delivery_reports"
      ADD CONSTRAINT "delivery_reports_reviewed_by_user_id_fkey"
      FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- delivery_report_lines
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_report_lines_delivery_report_id_fkey') THEN
    ALTER TABLE "delivery_report_lines"
      ADD CONSTRAINT "delivery_report_lines_delivery_report_id_fkey"
      FOREIGN KEY ("delivery_report_id") REFERENCES "delivery_reports" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_report_lines_po_line_item_id_fkey') THEN
    ALTER TABLE "delivery_report_lines"
      ADD CONSTRAINT "delivery_report_lines_po_line_item_id_fkey"
      FOREIGN KEY ("po_line_item_id") REFERENCES "po_line_items" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_report_lines_material_id_fkey') THEN
    ALTER TABLE "delivery_report_lines"
      ADD CONSTRAINT "delivery_report_lines_material_id_fkey"
      FOREIGN KEY ("material_id") REFERENCES "materials" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- delivery_damage_photos
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_damage_photos_delivery_report_line_id_fkey') THEN
    ALTER TABLE "delivery_damage_photos"
      ADD CONSTRAINT "delivery_damage_photos_delivery_report_line_id_fkey"
      FOREIGN KEY ("delivery_report_line_id") REFERENCES "delivery_report_lines" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_damage_photos_file_id_fkey') THEN
    ALTER TABLE "delivery_damage_photos"
      ADD CONSTRAINT "delivery_damage_photos_file_id_fkey"
      FOREIGN KEY ("file_id") REFERENCES "files" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- delivery_report_attachments
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_report_attachments_delivery_report_id_fkey') THEN
    ALTER TABLE "delivery_report_attachments"
      ADD CONSTRAINT "delivery_report_attachments_delivery_report_id_fkey"
      FOREIGN KEY ("delivery_report_id") REFERENCES "delivery_reports" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_report_attachments_file_id_fkey') THEN
    ALTER TABLE "delivery_report_attachments"
      ADD CONSTRAINT "delivery_report_attachments_file_id_fkey"
      FOREIGN KEY ("file_id") REFERENCES "files" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- delivery_access_codes
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_access_codes_purchase_order_id_fkey') THEN
    ALTER TABLE "delivery_access_codes"
      ADD CONSTRAINT "delivery_access_codes_purchase_order_id_fkey"
      FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
