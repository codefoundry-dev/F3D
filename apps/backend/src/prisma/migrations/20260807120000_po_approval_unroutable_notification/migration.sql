-- ── Empty Approver Pool fallback notification (FOR-302) ──────────────────────
-- A PO could reach PENDING_APPROVAL with an empty Approver Pool — no ACTIVE
-- user's `po.approve` cap covered the total — and the notifier returned
-- silently, stranding the order with no email and no eligible actor.
--
-- The fallback tells Company Admins (and the creator) that the order is stuck.
-- It is a notification only: Company Admins are recipients, NOT Pool members,
-- and their configured cap is not overridden.

-- AlterEnum: ADD VALUE cannot be repeated, hence the IF NOT EXISTS guard.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PO_APPROVAL_UNROUTABLE';
