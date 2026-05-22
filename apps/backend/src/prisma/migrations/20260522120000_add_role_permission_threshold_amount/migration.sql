-- FOR-196: Add an optional monetary cap to threshold-aware approval permissions
-- (e.g. po.approve, invoice.approve). Null = unlimited.
ALTER TABLE "role_permissions"
  ADD COLUMN "threshold_amount" DECIMAL(18, 4);
