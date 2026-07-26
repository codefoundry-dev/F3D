-- ── Email + in-app notification matrix (1st release) ─────────────────────────
-- Extends the notification feed to cover the remaining rows of the agreed
-- notification matrix: PO internal changes, invoice rejection/discrepancy and
-- the payment due/overdue reminders. Also gives Invoice the rejection reason
-- (carried into the vendor email as the user comment) and the reminder ledger
-- columns that keep the daily sweep idempotent.

-- AlterEnum: new notification types.
-- ADD VALUE cannot run inside an implicit transaction block on PG < 12 and
-- cannot be repeated, hence the IF NOT EXISTS guard on each.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PO_INTERNAL_CHANGE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INVOICE_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_DUE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_OVERDUE';

-- AlterEnum: invoices become a linkable notification target.
ALTER TYPE "NotificationEntityType" ADD VALUE IF NOT EXISTS 'INVOICE';

-- AlterTable: invoice rejection reason + reminder ledger.
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "due_reminder_sent_at" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "overdue_reminder_sent_at" TIMESTAMP(3);

-- CreateIndex: the daily reminder sweep scans APPROVED invoices by due date.
CREATE INDEX IF NOT EXISTS "idx_invoices_status_due_date" ON "invoices"("status", "due_date");
