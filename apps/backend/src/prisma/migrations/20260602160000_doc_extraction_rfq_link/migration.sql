-- AlterTable: link guest quote PDF extractions to their RFQ (FOR-206 vendor portal PDF upload)
ALTER TABLE "doc_extractions" ADD COLUMN "rfq_id" TEXT;

-- CreateIndex: scope the public guest-quote poll endpoint and RFQ traceability lookups
CREATE INDEX "idx_doc_extractions_rfq" ON "doc_extractions"("rfq_id");
