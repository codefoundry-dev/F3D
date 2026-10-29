-- FOR-395: one-off vendors. A vendor added from a project's Vendors tab is
-- assigned to the contractor for that project only: hidden from the company
-- vendor list and offered in RFQ/PO wizards for that project alone. Promoting
-- it to a full vendor clears the column. Deleting the project drops the
-- one-off assignment (the vendor company and its documents stay).
ALTER TABLE "company_vendor_assignments"
  ADD COLUMN IF NOT EXISTS "one_off_project_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "company_vendor_assignments"
    ADD CONSTRAINT "company_vendor_assignments_one_off_project_id_fkey"
    FOREIGN KEY ("one_off_project_id") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "idx_vendor_assignment_one_off_project"
  ON "company_vendor_assignments" ("one_off_project_id");
