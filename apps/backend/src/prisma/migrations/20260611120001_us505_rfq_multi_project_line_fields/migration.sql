-- US 5.05: RFQ creation flow — multi-project RFQs and per-line-item fields.
--
-- 1. rfqs.is_pick_up: the RFQ-level pick-up toggle from the Figma create flow
--    (pick_up_location already existed).
-- 2. rfq_projects: M:N link between an RFQ and the projects it spans.
--    rfqs.project_id remains the PRIMARY project (back-compat) and must always
--    also appear in rfq_projects — backfilled below for existing rows.
-- 3. rfq_line_items gains per-line project, delivery location, expected
--    delivery date, and a real `notes` column. `description` stays reserved
--    for the material description (the create DTO's `notes` used to be
--    persisted into it; new writes keep them separate — existing rows are
--    left untouched).

-- ── 1. RFQ-level pick-up flag ───────────────────────────────────────────────
ALTER TABLE "rfqs" ADD COLUMN "is_pick_up" BOOLEAN NOT NULL DEFAULT false;

-- ── 2. RFQ ↔ Project M:N ───────────────────────────────────────────────────
CREATE TABLE "rfq_projects" (
    "id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,

    CONSTRAINT "rfq_projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idx_rfq_projects_rfq_project" ON "rfq_projects"("rfq_id", "project_id");
CREATE INDEX "idx_rfq_projects_project" ON "rfq_projects"("project_id");

ALTER TABLE "rfq_projects" ADD CONSTRAINT "rfq_projects_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rfq_projects" ADD CONSTRAINT "rfq_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every existing RFQ's primary project also appears in rfq_projects.
INSERT INTO "rfq_projects" ("id", "rfq_id", "project_id")
SELECT gen_random_uuid()::text, r."id", r."project_id"
FROM "rfqs" r
ON CONFLICT ("rfq_id", "project_id") DO NOTHING;

-- ── 3. Per-line-item fields ─────────────────────────────────────────────────
ALTER TABLE "rfq_line_items" ADD COLUMN "notes" TEXT;
ALTER TABLE "rfq_line_items" ADD COLUMN "project_id" TEXT;
ALTER TABLE "rfq_line_items" ADD COLUMN "delivery_location_id" TEXT;
ALTER TABLE "rfq_line_items" ADD COLUMN "expected_delivery_date" TIMESTAMP(3);

CREATE INDEX "idx_rfq_line_items_project" ON "rfq_line_items"("project_id");
CREATE INDEX "idx_rfq_line_items_delivery_location" ON "rfq_line_items"("delivery_location_id");

ALTER TABLE "rfq_line_items" ADD CONSTRAINT "rfq_line_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rfq_line_items" ADD CONSTRAINT "rfq_line_items_delivery_location_id_fkey" FOREIGN KEY ("delivery_location_id") REFERENCES "project_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
