-- ── RFQ CC Recipients (FOR-203) ─────────────────────────────────────────────
-- Stores the list of CC email addresses captured on the RFQ "send" action so
-- the outbound vendor emails can copy the buyer's chosen recipients.
ALTER TABLE "rfqs" ADD COLUMN IF NOT EXISTS "cc_emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
