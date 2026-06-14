-- PO Change Request — sequential-per-PO human reference (e.g. "CR-001").
--
-- The PO detail "Changes request" tab and the resolved-CR Action-log entries
-- (US PO Change Request) show a stable "CR-###" label per purchase order. We
-- store it on the row at creation time; this migration adds the nullable column
-- and backfills existing rows per-PO in creation order so historical change
-- requests also carry a reference.
--
-- Hand-written + idempotent (see prisma-migrate-headless): safe to re-run and
-- tolerant of partial application. Do NOT `prisma migrate dev` here — the shell
-- is non-interactive; run `prisma migrate deploy` instead.

ALTER TABLE "po_change_requests"
  ADD COLUMN IF NOT EXISTS "reference" VARCHAR(20);

-- Backfill: number each PO's change requests CR-001, CR-002, … by creation
-- order. Only touches rows whose reference is still NULL, so re-runs are no-ops.
WITH numbered AS (
  SELECT
    "id",
    'CR-' || LPAD(
      (ROW_NUMBER() OVER (
        PARTITION BY "purchase_order_id"
        ORDER BY "created_at" ASC, "id" ASC
      ))::text,
      3,
      '0'
    ) AS "ref"
  FROM "po_change_requests"
  WHERE "reference" IS NULL
)
UPDATE "po_change_requests" AS pcr
SET "reference" = numbered."ref"
FROM numbered
WHERE pcr."id" = numbered."id";
