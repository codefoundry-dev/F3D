-- ── Invoice approval routing notifications (FOR-307) ─────────────────────────
-- Invoices gain the same Approver Pool routing purchase orders already have, so
-- they need the same two notification types:
--
--   INVOICE_PENDING_APPROVAL     — the reviewed total exceeded the reviewer's
--                                  `invoice.approve` cap, so the invoice was
--                                  routed to the Approver Pool.
--   INVOICE_APPROVAL_UNROUTABLE  — the Pool is empty: nobody's cap covers the
--                                  total. Goes to Company Admins (and the
--                                  reviewer) as a fallback RECIPIENT. It confers
--                                  no authority; the way out is raising a limit
--                                  or correcting the amount, exactly as for the
--                                  PO case (FOR-302).

-- AlterEnum: ADD VALUE cannot be repeated, hence the IF NOT EXISTS guard.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INVOICE_PENDING_APPROVAL';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INVOICE_APPROVAL_UNROUTABLE';
