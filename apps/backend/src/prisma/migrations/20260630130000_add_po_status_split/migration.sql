-- Add the SPLIT PurchaseOrder status (US 5.19). The vendorless consolidated
-- parent of a multi-vendor award carries this status so the parent/child split
-- is visible on the PO list/detail instead of masquerading as a DRAFT.
--
-- ALTER TYPE ... ADD VALUE is idempotent here via IF NOT EXISTS, and on
-- PostgreSQL 12+ it may run inside the migration transaction because the new
-- value is not used in the same transaction.
ALTER TYPE "PoStatus" ADD VALUE IF NOT EXISTS 'SPLIT';
