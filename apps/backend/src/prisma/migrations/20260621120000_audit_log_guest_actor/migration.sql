-- FOR-247: attribute tokenised guest PO actions (acknowledge / accept / decline)
-- in the audit trail. A guest acts via a validated access token with no user
-- account, so performed_by_id becomes nullable and performed_by_label carries a
-- human label for the trail (mirrors rfq_activity_logs). Backward-compatible:
-- existing rows keep their performer, and the foreign key still applies whenever
-- performed_by_id is present.

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "performed_by_id" DROP NOT NULL;
ALTER TABLE "audit_logs" ADD COLUMN "performed_by_label" VARCHAR(255);
