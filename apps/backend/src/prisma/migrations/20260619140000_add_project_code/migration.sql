-- US 5.03 / 5.04: Human-readable Project code (e.g. "PRJ-2025-001").
-- Adds projects.code, a per-company / per-year sequential identifier surfaced
-- on the project list + detail. Added nullable first, backfilled with a
-- deterministic per-(company, year) sequence over existing rows, then made
-- NOT NULL and uniquely indexed per company.
--
-- Hand-written (see prisma-migrate-headless): the shell is non-interactive so
-- do NOT `prisma migrate dev` here — run `prisma migrate deploy`. Dev Postgres
-- is on port 5433. Staging/prod must be deployed manually.

-- ── 1) Add column (nullable first so existing rows survive the ALTER) ─────────
ALTER TABLE "projects" ADD COLUMN "code" VARCHAR(20);

-- ── 2) Backfill existing rows with a per-company, per-year sequence ───────────
WITH seq AS (
  SELECT id,
    'PRJ-' || to_char(created_at, 'YYYY') || '-' ||
    lpad((row_number() OVER (PARTITION BY company_id, date_part('year', created_at) ORDER BY created_at, id))::text, 3, '0') AS new_code
  FROM projects
)
UPDATE projects p SET code = seq.new_code FROM seq WHERE p.id = seq.id;

-- ── 3) Enforce NOT NULL now that every row has a code ─────────────────────────
ALTER TABLE "projects" ALTER COLUMN "code" SET NOT NULL;

-- ── 4) Unique per company ─────────────────────────────────────────────────────
CREATE UNIQUE INDEX "idx_projects_company_code" ON "projects"("company_id", "code");
