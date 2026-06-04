-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'DELIVERY_DELAYED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailEventType" AS ENUM ('SENT', 'DELIVERED', 'DELIVERY_DELAYED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'FAILED');

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "rfq_id" TEXT,
    "purchase_order_id" TEXT,
    "template" VARCHAR(100) NOT NULL,
    "to_email" VARCHAR(320) NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "provider" VARCHAR(20) NOT NULL DEFAULT 'RESEND',
    "provider_message_id" VARCHAR(255),
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "sent_by_user_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "bounced_at" TIMESTAMP(3),
    "complained_at" TIMESTAMP(3),
    "open_count" INTEGER NOT NULL DEFAULT 0,
    "bounce_type" VARCHAR(100),
    "bounce_reason" TEXT,
    "last_event_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_events" (
    "id" TEXT NOT NULL,
    "email_message_id" TEXT NOT NULL,
    "type" "EmailEventType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "provider_event_id" VARCHAR(255),
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_provider_message_id_key" ON "email_messages"("provider_message_id");

-- CreateIndex
CREATE INDEX "idx_email_messages_rfq" ON "email_messages"("rfq_id");

-- CreateIndex
CREATE INDEX "idx_email_messages_po" ON "email_messages"("purchase_order_id");

-- CreateIndex
CREATE INDEX "idx_email_messages_company" ON "email_messages"("company_id");

-- CreateIndex
CREATE INDEX "idx_email_events_message" ON "email_events"("email_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_email_events_dedupe" ON "email_events"("email_message_id", "type", "occurred_at");

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_email_message_id_fkey" FOREIGN KEY ("email_message_id") REFERENCES "email_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
