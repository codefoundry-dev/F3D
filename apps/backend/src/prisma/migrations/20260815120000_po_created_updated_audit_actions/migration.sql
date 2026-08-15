-- FOR-353: PO activity history — audit PO creation and draft edits.
-- AlterEnum: AuditAction — add new values
ALTER TYPE "AuditAction" ADD VALUE 'PO_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'PO_UPDATED';
