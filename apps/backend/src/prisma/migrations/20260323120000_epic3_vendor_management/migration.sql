-- Epic 3: Vendor Management schema additions
-- US-3.03: In-app messaging
-- US-3.06: Quote response line items
-- US-3.07: Warehouse locations
-- US-5.20: Bulk order change requests

-- ============================================================================
-- Enums
-- ============================================================================

-- CreateEnum: MessageContextType
CREATE TYPE "MessageContextType" AS ENUM (
    'RFQ',
    'PURCHASE_ORDER',
    'MATERIAL_REQUEST',
    'WAREHOUSE_RELEASE_REQUEST'
);

-- CreateEnum: QuoteLineItemAvailability
CREATE TYPE "QuoteLineItemAvailability" AS ENUM (
    'AVAILABLE',
    'PARTIALLY_AVAILABLE',
    'UNAVAILABLE',
    'NO_QUOTE'
);

-- CreateEnum: QuoteLineItemStatus
CREATE TYPE "QuoteLineItemStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'DECLINED'
);

-- CreateEnum: BulkOrderChangeRequestStatus
CREATE TYPE "BulkOrderChangeRequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);

-- AlterEnum: AuditAction — add new values
ALTER TYPE "AuditAction" ADD VALUE 'VENDOR_USER_INVITED';
ALTER TYPE "AuditAction" ADD VALUE 'QUOTE_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'QUOTE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'PO_ACCEPTED_BY_VENDOR';
ALTER TYPE "AuditAction" ADD VALUE 'PO_DECLINED_BY_VENDOR';
ALTER TYPE "AuditAction" ADD VALUE 'BULK_ORDER_CHANGE_PROPOSED';
ALTER TYPE "AuditAction" ADD VALUE 'BULK_ORDER_CHANGE_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'BULK_ORDER_CHANGE_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE 'BULK_ORDER_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'MESSAGE_SENT';

-- ============================================================================
-- US-3.03: Message Thread & Messages
-- ============================================================================

-- CreateTable: message_threads
CREATE TABLE "message_threads" (
    "id" TEXT NOT NULL,
    "context_type" "MessageContextType" NOT NULL,
    "context_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable: thread_participants
CREATE TABLE "thread_participants" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thread_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable: messages
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "sender_user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: message_attachments
CREATE TABLE "message_attachments" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: message_threads
CREATE UNIQUE INDEX "idx_message_thread_context_unique" ON "message_threads"("context_type", "context_id");
CREATE INDEX "idx_message_thread_context" ON "message_threads"("context_type", "context_id");

-- CreateIndex: thread_participants
CREATE UNIQUE INDEX "idx_thread_participant_unique" ON "thread_participants"("thread_id", "user_id");
CREATE INDEX "idx_thread_participant_user" ON "thread_participants"("user_id");

-- CreateIndex: messages
CREATE INDEX "idx_messages_thread_created" ON "messages"("thread_id", "created_at");

-- CreateIndex: message_attachments
CREATE INDEX "idx_message_attachments_message" ON "message_attachments"("message_id");

-- AddForeignKey: thread_participants
ALTER TABLE "thread_participants"
    ADD CONSTRAINT "thread_participants_thread_id_fkey"
    FOREIGN KEY ("thread_id") REFERENCES "message_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "thread_participants"
    ADD CONSTRAINT "thread_participants_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: messages
ALTER TABLE "messages"
    ADD CONSTRAINT "messages_thread_id_fkey"
    FOREIGN KEY ("thread_id") REFERENCES "message_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages"
    ADD CONSTRAINT "messages_sender_user_id_fkey"
    FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: message_attachments
ALTER TABLE "message_attachments"
    ADD CONSTRAINT "message_attachments_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_attachments"
    ADD CONSTRAINT "message_attachments_file_id_fkey"
    FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- US-3.07: Warehouse Locations
-- ============================================================================

-- CreateTable: warehouse_locations
CREATE TABLE "warehouse_locations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "city" VARCHAR(255) NOT NULL,
    "postcode" VARCHAR(20) NOT NULL,
    "address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: warehouse_locations
CREATE INDEX "idx_warehouse_locations_company" ON "warehouse_locations"("company_id");

-- AddForeignKey: warehouse_locations
ALTER TABLE "warehouse_locations"
    ADD CONSTRAINT "warehouse_locations_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- US-3.06: Quote Response enrichment + Line Items
-- ============================================================================

-- AlterTable: quote_responses — add bulk-level fields
ALTER TABLE "quote_responses"
    ADD COLUMN "bulk_delivery_time" TIMESTAMP(3),
    ADD COLUMN "bulk_discount" DECIMAL(5,2),
    ADD COLUMN "bulk_tax" DECIMAL(5,2),
    ADD COLUMN "bulk_shipment" DECIMAL(18,4),
    ADD COLUMN "warehouse_location_id" TEXT,
    ADD COLUMN "validity_period" TIMESTAMP(3),
    ADD COLUMN "message" TEXT;

-- AddForeignKey: quote_responses → warehouse_locations
ALTER TABLE "quote_responses"
    ADD CONSTRAINT "quote_responses_warehouse_location_id_fkey"
    FOREIGN KEY ("warehouse_location_id") REFERENCES "warehouse_locations"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: quote_response_line_items
CREATE TABLE "quote_response_line_items" (
    "id" TEXT NOT NULL,
    "quote_response_id" TEXT NOT NULL,
    "rfq_line_item_id" TEXT NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "quoted_quantity" INTEGER NOT NULL,
    "availability" "QuoteLineItemAvailability" NOT NULL DEFAULT 'AVAILABLE',
    "delivery_date" TIMESTAMP(3) NOT NULL,
    "substitute_item_id" TEXT,
    "discount" DECIMAL(18,4),
    "discount_type" VARCHAR(10),
    "tax" DECIMAL(5,2),
    "tax_included" BOOLEAN NOT NULL DEFAULT false,
    "back_order_qty" INTEGER,
    "back_order_delivery_date" TIMESTAMP(3),
    "notes" TEXT,
    "line_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "QuoteLineItemStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "quote_response_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: quote_response_line_items
CREATE INDEX "idx_quote_line_items_response" ON "quote_response_line_items"("quote_response_id");
CREATE INDEX "idx_quote_line_items_rfq_item" ON "quote_response_line_items"("rfq_line_item_id");

-- AddForeignKey: quote_response_line_items
ALTER TABLE "quote_response_line_items"
    ADD CONSTRAINT "quote_response_line_items_quote_response_id_fkey"
    FOREIGN KEY ("quote_response_id") REFERENCES "quote_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quote_response_line_items"
    ADD CONSTRAINT "quote_response_line_items_rfq_line_item_id_fkey"
    FOREIGN KEY ("rfq_line_item_id") REFERENCES "rfq_line_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quote_response_line_items"
    ADD CONSTRAINT "quote_response_line_items_substitute_item_id_fkey"
    FOREIGN KEY ("substitute_item_id") REFERENCES "materials"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- US-5.20: Bulk Order Change Requests + Versioning
-- ============================================================================

-- AlterTable: bulk_orders — add version
ALTER TABLE "bulk_orders"
    ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable: bulk_order_change_requests
CREATE TABLE "bulk_order_change_requests" (
    "id" TEXT NOT NULL,
    "bulk_order_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "message" TEXT,
    "status" "BulkOrderChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulk_order_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: bulk_order_change_requests
CREATE INDEX "idx_bulk_order_change_requests_order" ON "bulk_order_change_requests"("bulk_order_id");
CREATE INDEX "idx_bulk_order_change_requests_status" ON "bulk_order_change_requests"("status");

-- AddForeignKey: bulk_order_change_requests
ALTER TABLE "bulk_order_change_requests"
    ADD CONSTRAINT "bulk_order_change_requests_bulk_order_id_fkey"
    FOREIGN KEY ("bulk_order_id") REFERENCES "bulk_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bulk_order_change_requests"
    ADD CONSTRAINT "bulk_order_change_requests_requested_by_user_id_fkey"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bulk_order_change_requests"
    ADD CONSTRAINT "bulk_order_change_requests_resolved_by_user_id_fkey"
    FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
