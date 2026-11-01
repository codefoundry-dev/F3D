-- FOR-386: delivery report numbers ("DR-00001") are sequenced PER COMPANY, but
-- report_number was globally unique, so the first report of every company after
-- the first collided (P2002 -> HTTP 500 on submit). Scope uniqueness to the
-- company instead.
DROP INDEX IF EXISTS "delivery_reports_report_number_key";

CREATE UNIQUE INDEX IF NOT EXISTS "uq_delivery_reports_company_report_number"
  ON "delivery_reports" ("company_id", "report_number");
