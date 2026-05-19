-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('Insurance', 'License', 'Certification', 'Other');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_CREATED', 'USER_UPDATED', 'USER_DEACTIVATED', 'USER_REACTIVATED', 'USER_INVITATION_RESENT', 'USER_INVITATION_CANCELLED', 'USER_PASSWORD_RESET_INITIATED', 'COMPANY_CREATED', 'COMPANY_UPDATED', 'FILE_UPLOADED', 'FILE_DELETED', 'PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_MEMBER_ADDED', 'PROJECT_MEMBER_REMOVED', 'VENDOR_ASSIGNED', 'VENDOR_UNASSIGNED');

-- CreateTable
CREATE TABLE "company_vendor_assignments" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_vendor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "bucket" VARCHAR(100) NOT NULL,
    "key" VARCHAR(500) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_documents" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "file_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "performed_by_id" TEXT NOT NULL,
    "target_type" VARCHAR(50) NOT NULL,
    "target_id" TEXT NOT NULL,
    "target_label" VARCHAR(255),
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_vendor_assignment_vendor" ON "company_vendor_assignments"("vendor_id");

-- CreateIndex
CREATE INDEX "idx_vendor_assignment_contractor" ON "company_vendor_assignments"("contractor_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_vendor_contractor_unique" ON "company_vendor_assignments"("vendor_id", "contractor_id");

-- CreateIndex
CREATE INDEX "idx_files_uploaded_by" ON "files"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "idx_company_documents_company" ON "company_documents"("company_id");

-- CreateIndex
CREATE INDEX "idx_audit_log_action" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "idx_audit_log_performer" ON "audit_logs"("performed_by_id");

-- CreateIndex
CREATE INDEX "idx_audit_log_target" ON "audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "idx_audit_log_created_at" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "company_vendor_assignments" ADD CONSTRAINT "company_vendor_assignments_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_vendor_assignments" ADD CONSTRAINT "company_vendor_assignments_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
