-- ── Approver Pool nominations (FOR-306) ──────────────────────────────────────
-- One polymorphic table serving both PO and Invoice, matching the
-- entityType/entityId precedent set by `notifications` and delivering
-- ADR-0006's "reusable across entities" intent.
--
-- A Nomination is ROUTING ONLY: it records that the document's creator (PO) or
-- reviewer (Invoice) asked specific Approver Pool members to look at it. It
-- confers no authority — every Pool member can still approve a document they
-- were not nominated for — which is what makes it safe while ADR-0006's
-- Out-of-Office delegation remains unbuilt: an absent nominee can never block.
--
-- The Approver Pool itself is deliberately NOT stored. It is recomputed live
-- from role/custom-role grants on every read, because authorisation is
-- evaluated live at approve time and a frozen Pool would name approvers who
-- then hit a 403.
--
-- Trade-off accepted: no FK on entity_id (it points at either table), so
-- cascade-on-delete is handled in application code.

CREATE TYPE "ApprovalEntityType" AS ENUM ('PURCHASE_ORDER', 'INVOICE');

CREATE TABLE "approval_nominations" (
    "id" TEXT NOT NULL,
    "entity_type" "ApprovalEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nominated_by_id" TEXT NOT NULL,
    -- Denormalised from the document so the row satisfies the RLS model in
    -- ADR-0009 without joining through a polymorphic, FK-less entity_id.
    "company_id" TEXT NOT NULL,
    "nominated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_nominations_pkey" PRIMARY KEY ("id")
);

-- Re-nominating an existing nominee is a no-op rather than a fresh email.
CREATE UNIQUE INDEX "uq_approval_nominations_entity_user"
    ON "approval_nominations"("entity_type", "entity_id", "user_id");
CREATE INDEX "idx_approval_nominations_entity"
    ON "approval_nominations"("entity_type", "entity_id");
CREATE INDEX "idx_approval_nominations_company" ON "approval_nominations"("company_id");
CREATE INDEX "idx_approval_nominations_user" ON "approval_nominations"("user_id");

ALTER TABLE "approval_nominations"
    ADD CONSTRAINT "approval_nominations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_nominations"
    ADD CONSTRAINT "approval_nominations_nominated_by_id_fkey"
    FOREIGN KEY ("nominated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_nominations"
    ADD CONSTRAINT "approval_nominations_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
