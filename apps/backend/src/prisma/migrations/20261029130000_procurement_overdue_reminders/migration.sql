-- FOR-394: email + in-app reminders when requested items pass their date.
-- Reminder ledgers: stamped (claimed) before a reminder is sent, so a daily
-- re-run or a second container never sends the same one twice.
ALTER TABLE "material_requests" ADD COLUMN IF NOT EXISTS "overdue_reminder_sent_at" TIMESTAMP(3);
ALTER TABLE "rfqs" ADD COLUMN IF NOT EXISTS "overdue_reminder_sent_at" TIMESTAMP(3);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "overdue_reminder_sent_at" TIMESTAMP(3);

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MATERIAL_REQUEST_OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RFQ_OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PO_DELIVERY_OVERDUE';
