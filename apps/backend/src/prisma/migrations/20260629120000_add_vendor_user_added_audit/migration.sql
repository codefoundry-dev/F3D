-- FOR-272: distinguish a representative ADDED without an invitation email
-- from one that was INVITED (VENDOR_USER_INVITED). PostgreSQL 16 allows
-- ALTER TYPE ... ADD VALUE inside the migration transaction as long as the
-- new value is not used in the same transaction (it is not).
ALTER TYPE "AuditAction" ADD VALUE 'VENDOR_USER_ADDED';
