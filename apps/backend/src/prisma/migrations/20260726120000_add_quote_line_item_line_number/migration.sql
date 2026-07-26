-- Quote response line items had no ordering column, so every read returned them
-- in Postgres heap order. Updating one line's status rewrites its tuple and
-- moves it to the end of that order, which reshuffled the review table and made
-- an approve on one line look like it had landed on the next line.

ALTER TABLE "quote_response_line_items"
  ADD COLUMN "line_number" INTEGER NOT NULL DEFAULT 0;

-- Backfill from the current physical order so existing quotes keep the row
-- order their reviewers already see.
WITH ordered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "quote_response_id" ORDER BY "ctid") - 1 AS "position"
  FROM "quote_response_line_items"
)
UPDATE "quote_response_line_items" AS qli
SET "line_number" = ordered."position"
FROM ordered
WHERE qli."id" = ordered."id";

CREATE INDEX "idx_quote_line_items_response_order"
  ON "quote_response_line_items" ("quote_response_id", "line_number");
