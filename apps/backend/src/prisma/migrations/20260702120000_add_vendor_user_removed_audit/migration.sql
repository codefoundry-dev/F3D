-- Audit action for deleting a never-activated vendor representative
-- (ADR-0016 remove-representative verb, distinct from cancelling an
-- invitation which now only revokes the token). PostgreSQL 16 allows
-- ADD VALUE outside a transaction block via prisma migrate.
ALTER TYPE "AuditAction" ADD VALUE 'VENDOR_USER_REMOVED';
