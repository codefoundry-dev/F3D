-- FOR-398: general terms & conditions on purchase orders.
-- Company default, editable by the Company Admin in Settings.
ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "po_terms_and_conditions" TEXT;

-- Per-PO snapshot, copied from the company default when the PO is created.
ALTER TABLE "purchase_orders"
  ADD COLUMN IF NOT EXISTS "terms_and_conditions" TEXT;
