-- ── Material Request approval routing (FOR-347) ──────────────────────────────
-- Material Requests join the Approver Pool + Nomination system built for POs
-- and Invoices (ADR-0006 amendment). An MR carries no monetary value, so its
-- Pool is grant-membership — everyone holding `materialRequest.approve` — not
-- cap-coverage, and its approval state is derived from MaterialRequestStatus
-- rather than stored (no new columns on material_requests).
--
--   ApprovalEntityType.MATERIAL_REQUEST          — nominations may now target MRs.
--   MATERIAL_REQUEST_PENDING_APPROVAL            — an MR was submitted and awaits
--                                                  an approver; sent to the Pool
--                                                  (narrowed by nominations).
--   MATERIAL_REQUEST_APPROVAL_UNROUTABLE         — the Pool is empty: nobody in
--                                                  the company holds the approve
--                                                  grant. Goes to Company Admins
--                                                  (and the requester) as a
--                                                  fallback RECIPIENT; the way
--                                                  out is granting the permission
--                                                  under Roles & permissions.
--   NotificationEntityType.MATERIAL_REQUEST      — lets the bell deep-link to the
--                                                  material request detail page.

-- AlterEnum: ADD VALUE cannot be repeated, hence the IF NOT EXISTS guard.
ALTER TYPE "ApprovalEntityType" ADD VALUE IF NOT EXISTS 'MATERIAL_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MATERIAL_REQUEST_PENDING_APPROVAL';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MATERIAL_REQUEST_APPROVAL_UNROUTABLE';
ALTER TYPE "NotificationEntityType" ADD VALUE IF NOT EXISTS 'MATERIAL_REQUEST';
