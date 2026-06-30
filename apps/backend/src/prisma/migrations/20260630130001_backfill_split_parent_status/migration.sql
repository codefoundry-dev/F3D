-- Backfill existing SPLIT-type parent POs (US 5.19) from DRAFT to the new SPLIT
-- status so they read consistently with newly-awarded splits.
--
-- A SPLIT-type PurchaseOrder is only ever the vendorless consolidated parent of
-- a multi-vendor award — it is never issued — so moving it off DRAFT is safe and
-- carries no lifecycle meaning. Scoped to DRAFT (the only status these parents
-- have ever had) to stay idempotent. Kept in a separate migration from the
-- enum-value addition: PostgreSQL forbids using a new enum value in the same
-- transaction that added it.
UPDATE "purchase_orders" SET "status" = 'SPLIT' WHERE "po_type" = 'SPLIT' AND "status" = 'DRAFT';
