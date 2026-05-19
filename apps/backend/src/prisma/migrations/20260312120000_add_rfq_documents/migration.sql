-- CreateTable
CREATE TABLE "rfq_documents" (
    "id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfq_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_rfq_documents_rfq" ON "rfq_documents"("rfq_id");

-- AddForeignKey
ALTER TABLE "rfq_documents" ADD CONSTRAINT "rfq_documents_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_documents" ADD CONSTRAINT "rfq_documents_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
