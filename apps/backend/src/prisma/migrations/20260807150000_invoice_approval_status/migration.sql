-- ── Invoice approval state (FOR-307) ─────────────────────────────────────────
-- Gives Invoice the same approval axis PurchaseOrder already has, so the
-- Approver Pool logic is written once and parameterised by permission key.
--
-- Deliberately NOT a new `InvoiceStatus` value: ADR-0006 keeps approval state
-- separate from document state. `invoices.status` continues to mean where the
-- invoice is in its own lifecycle (PENDING / APPROVED / DISPUTED / PAID /
-- REJECTED); `approval_status` means whether spend authority has signed off.
-- Collapsing them would make the Pool logic entity-specific.
--
-- Additive and backfill-free: NOT_REQUIRED is the correct state for every
-- existing invoice, because until now no invoice was ever routed for approval
-- (the `invoice.approve` cap was enforced nowhere — see FOR-303).

ALTER TABLE "invoices"
    ADD COLUMN IF NOT EXISTS "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "approved_by_id" TEXT;

ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
