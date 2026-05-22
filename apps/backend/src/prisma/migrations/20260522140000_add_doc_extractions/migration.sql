-- FOR-199: Document intelligence pipeline — generic extraction records that
-- can be reused across BOMs, quotes, invoices, and future doc types.

-- CreateEnum
CREATE TYPE "DocExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocExtractionType" AS ENUM ('BOM', 'QUOTE', 'INVOICE', 'GENERIC');

-- CreateTable
CREATE TABLE "doc_extractions" (
    "id" TEXT NOT NULL,
    "type" "DocExtractionType" NOT NULL,
    "status" "DocExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "file_id" TEXT NOT NULL,
    "raw_result" JSONB,
    "edited_result" JSONB,
    "error_code" VARCHAR(64),
    "error_message" TEXT,
    "model" VARCHAR(100),
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "created_by_user_id" TEXT NOT NULL,
    "company_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "doc_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_doc_extractions_created_by" ON "doc_extractions"("created_by_user_id");

-- CreateIndex
CREATE INDEX "idx_doc_extractions_company_status" ON "doc_extractions"("company_id", "status");

-- CreateIndex
CREATE INDEX "idx_doc_extractions_type_status" ON "doc_extractions"("type", "status");

-- AddForeignKey
ALTER TABLE "doc_extractions" ADD CONSTRAINT "doc_extractions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_extractions" ADD CONSTRAINT "doc_extractions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_extractions" ADD CONSTRAINT "doc_extractions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
