-- ── Project-based RFQ notifications (FOR-351) ────────────────────────────────
-- When an RFQ is sent, every member of every project the RFQ spans receives an
-- in-app notification — the counterpart of the FOR-255 email CC and the
-- ADR-0011 "fan out via role + project assignment" rule. RFQ_RECEIVED stays the
-- vendor-facing type; RFQ_SENT is the buyer/project-member-facing one.

-- AlterEnum: ADD VALUE cannot be repeated, hence the IF NOT EXISTS guard.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RFQ_SENT';
