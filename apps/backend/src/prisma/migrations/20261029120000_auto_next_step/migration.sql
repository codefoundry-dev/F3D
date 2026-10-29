-- FOR-396: generate the next procurement step automatically.
-- Company setting: approving a material request also converts it to a draft RFQ.
ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "auto_convert_approved_mr_to_rfq" BOOLEAN NOT NULL DEFAULT false;

-- Activity-log entry for the daily job that flips a scheduled PO to
-- LATE_FOR_DELIVERY once its expected delivery date has passed.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PO_MARKED_LATE';
