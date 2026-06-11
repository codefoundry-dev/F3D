-- AlterTable: add the buyer-facing document_name column to rfqs (US 5.05).
-- Drift repair: the Rfq.name `@map("document_name")` field shipped on main in
-- ae34e78 without its migration. The original (20260610090000) lived only on the
-- unmerged branch fix/rfq-design-alignment-a-b, so staging/prod never got the
-- column and every rfq.findMany() returned HTTP 500. IF NOT EXISTS keeps this
-- safe on any environment where an earlier `prisma db push` already created it.
ALTER TABLE "rfqs" ADD COLUMN IF NOT EXISTS "document_name" VARCHAR(255);
