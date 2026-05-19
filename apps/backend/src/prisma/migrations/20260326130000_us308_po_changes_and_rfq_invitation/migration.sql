-- ── RFQ Vendor Invitation Token ──────────────────────────────────────────────
ALTER TABLE "rfq_vendors" ADD COLUMN IF NOT EXISTS "invitation_token" VARCHAR(16);
CREATE UNIQUE INDEX IF NOT EXISTS "rfq_vendors_invitation_token_key" ON "rfq_vendors"("invitation_token");

-- ── DiscountType Enum ───────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'AMOUNT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "quote_response_line_items"
  ALTER COLUMN "discount_type" TYPE "DiscountType" USING "discount_type"::"DiscountType";

-- ── PO Warehouse Location ───────────────────────────────────────────────────
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "warehouse_location_id" TEXT;

-- ── PO Change Request Extensions ────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE "PoChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "po_change_requests"
  ADD COLUMN IF NOT EXISTS "message" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "PoChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "resolved_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP(3);

ALTER TABLE "po_change_requests" DROP COLUMN IF EXISTS "approved_by_id";

CREATE INDEX IF NOT EXISTS "idx_po_change_requests_status" ON "po_change_requests"("status");

DO $$ BEGIN
  ALTER TABLE "po_change_requests"
    ADD CONSTRAINT "po_change_requests_resolved_by_id_fkey"
    FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Audit Action Extensions ─────────────────────────────────────────────────
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PO_CHANGE_PROPOSED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PO_CHANGE_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PO_CHANGE_REJECTED';
