-- Week-3 PO state machine / audit / reason-capture deliverables.
--
-- 1) Adds the canonical cancellation/decline reason column on purchase_orders
--    (previously the vendor decline reason was overloaded onto delivery_notes).
-- 2) Adds the PO lifecycle AuditAction enum values used by the now-audited PO
--    status transitions (issue/approve/decline/cancel/acknowledge/accept/
--    schedule/partially-deliver/deliver/archive).
--
-- Hand-written + idempotent (see prisma-migrate-headless): safe to re-run and
-- tolerant of partial application. Do NOT `prisma migrate dev` here — the shell
-- is non-interactive; run `prisma migrate deploy` instead. Dev Postgres is on
-- port 5433.

-- ── 1) Reason capture ────────────────────────────────────────────────────────
ALTER TABLE "purchase_orders"
  ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT;

-- ── 2) PO lifecycle audit actions ────────────────────────────────────────────
-- ALTER TYPE … ADD VALUE cannot run inside a transaction block in older
-- Postgres; "IF NOT EXISTS" makes each statement a safe no-op on re-run.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PO_ISSUED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PO_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PO_DECLINED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PO_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PO_ACKNOWLEDGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PO_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PO_SCHEDULED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PO_PARTIALLY_DELIVERED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PO_DELIVERED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PO_ARCHIVED';
