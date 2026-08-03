-- FOR-294: invoice state transitions (approve / reject) are recorded on the
-- audit trail with the reviewer's reason in metadata.
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_REJECTED';
