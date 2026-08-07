-- ── Drop the vestigial RFQ approval fields (FOR-305) ─────────────────────────
-- `rfqs.approval_status` and `rfqs.approved_by_id` were never written by any
-- backend path — there is no `rfq.approve` permission key — so the "Approved By"
-- detail field and export column they fed were permanently blank.
--
-- RFQs gain no approval gate (ADR-0006 amendment, "Not changed"): an RFQ carries
-- no monetary value anywhere in the model — `Rfq` has only `total_requested_qty`
-- (a unit count) and `RfqLineItem` has no price — so there is no total to test
-- against a cap. Deriving an estimate from `Material.price_per_unit` was
-- considered and rejected: `rfq_line_items.material_id` is nullable by design
-- (FOR-204), so BOM-sourced and free-text lines would contribute zero and a
-- creator could dodge approval by typing lines as free text. The RFQ→PO thread
-- meets its money gate where money first exists: at award, and again at PO issue.
--
-- Destructive but data-free: every value in both columns is NULL, since nothing
-- ever wrote them.

ALTER TABLE "rfqs" DROP COLUMN IF EXISTS "approval_status";
ALTER TABLE "rfqs" DROP COLUMN IF EXISTS "approved_by_id";
