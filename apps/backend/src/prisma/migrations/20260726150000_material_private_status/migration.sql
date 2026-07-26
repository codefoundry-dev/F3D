-- A company's own catalogue is private, not a submission to the public one.
--
-- Uploading a catalogue as a Company-Admin / Procurement-Officer used to mint
-- PENDING_APPROVAL rows queued for a Super-Admin to publish. That contribution
-- flow is deferred to v2 (spec FR-R1-D04) and the public catalogue is read-only
-- for contractors in Release 1, so a company upload now stays private to that
-- company and is usable immediately. PENDING_APPROVAL stopped describing those
-- rows, hence a dedicated PRIVATE state.
--
-- Split across two migrations on purpose: Postgres refuses to USE a new enum
-- value in the same transaction that adds it ("unsafe use of new value of enum
-- type"), and Prisma runs each migration file in one transaction. This file only
-- adds the value; 20260726150100 backfills with it.

ALTER TYPE "MaterialStatus" ADD VALUE IF NOT EXISTS 'PRIVATE';
