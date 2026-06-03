-- FOR-207: quote storage against RFQ with audit trail

-- CreateEnum
CREATE TYPE "QuoteSource" AS ENUM ('FORM', 'PDF');

-- CreateEnum
CREATE TYPE "QuoteAuditAction" AS ENUM ('SUBMITTED', 'UPDATED', 'APPROVED', 'DECLINED');

-- AlterTable: record how a quote was entered (form vs PDF). Existing rows default to FORM.
ALTER TABLE "quote_responses" ADD COLUMN "source" "QuoteSource" NOT NULL DEFAULT 'FORM';

-- CreateTable: per-RFQ quote audit trail
CREATE TABLE "quote_audits" (
    "id" TEXT NOT NULL,
    "quote_response_id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "action" "QuoteAuditAction" NOT NULL,
    "source" "QuoteSource",
    "performed_by_id" TEXT,
    "performed_by_label" VARCHAR(255),
    "changes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_quote_audits_rfq" ON "quote_audits"("rfq_id");

-- CreateIndex
CREATE INDEX "idx_quote_audits_quote" ON "quote_audits"("quote_response_id");

-- AddForeignKey
ALTER TABLE "quote_audits" ADD CONSTRAINT "quote_audits_quote_response_id_fkey" FOREIGN KEY ("quote_response_id") REFERENCES "quote_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_audits" ADD CONSTRAINT "quote_audits_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_audits" ADD CONSTRAINT "quote_audits_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
