-- FOR-259: OCR-first extraction for uploaded company/vendor documents.

-- New extraction type for company/vendor documents (insurance, licenses, certifications).
ALTER TYPE "DocExtractionType" ADD VALUE 'VENDOR_DOCUMENT';

-- Link an extraction back to the company document it was created for.
-- Plain scalar (no relation), same decoupling rationale as rfq_id/invoice_id.
ALTER TABLE "doc_extractions" ADD COLUMN "company_document_id" TEXT;

-- CreateIndex
CREATE INDEX "idx_doc_extractions_company_document" ON "doc_extractions"("company_document_id");

-- OCR observability: the page-averaged confidence Google Vision reported, and
-- whether the OCR text (vs the raw document) is what reached the LLM.
ALTER TABLE "doc_extractions" ADD COLUMN "ocr_confidence" DOUBLE PRECISION;
ALTER TABLE "doc_extractions" ADD COLUMN "ocr_used" BOOLEAN NOT NULL DEFAULT false;
