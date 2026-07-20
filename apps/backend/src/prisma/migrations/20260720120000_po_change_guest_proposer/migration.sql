-- Guest (tokenised PO portal) vendors can propose change requests without a user
-- account. `requested_by_id` becomes nullable and a human label attributes the
-- guest proposer instead (mirrors audit_logs.performed_by_id / performed_by_label,
-- FOR-247).

-- Drop the NOT NULL so a guest-proposed CR can have no requesting user.
ALTER TABLE "po_change_requests" ALTER COLUMN "requested_by_id" DROP NOT NULL;

-- Human-readable actor label for a guest proposer (e.g. the vendor name).
ALTER TABLE "po_change_requests" ADD COLUMN "requested_by_label" TEXT;
