-- ── In-app notifications (bell + panel + SSE feed) ───────────────────────────
-- One row per notification per recipient. Mirrors the branded transactional
-- emails plus new message-thread messages into an in-app feed. See
-- docs/adr/0011-notifications.md.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'RFQ_RECEIVED',
    'QUOTE_SUBMITTED',
    'QUOTE_UPDATED',
    'PO_ISSUED',
    'PO_PENDING_APPROVAL',
    'PO_DECLINED',
    'CHANGE_REQUEST_PROPOSED',
    'CHANGE_REQUEST_APPROVED',
    'CHANGE_REQUEST_REJECTED',
    'BULK_ORDER_CANCELLED',
    'MESSAGE_RECEIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "NotificationEntityType" AS ENUM (
    'RFQ',
    'QUOTE_RESPONSE',
    'PURCHASE_ORDER',
    'BULK_ORDER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entity_type" "NotificationEntityType",
    "entity_id" TEXT,
    "metadata" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_notifications_user_created" ON "notifications"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_notifications_user_read" ON "notifications"("user_id", "read_at");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
