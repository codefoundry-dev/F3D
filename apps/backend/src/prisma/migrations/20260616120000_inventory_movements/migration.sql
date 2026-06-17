-- Inventory movement engine — Epic 7 (Week-3 inventory hook).
--
-- Creates the StockMovementType / StockMovementSource enums, the running
-- stock_balances table (one on-hand figure per material per location), and the
-- append-only stock_movements ledger. Balances are uniquely keyed on
-- (material_id, location_id); movements always store a POSITIVE quantity with
-- `type` carrying the IN/OUT direction and `balance_after` the resulting on-hand.
--
-- Hand-written + idempotent (see prisma-migrate-headless): safe to re-run and
-- tolerant of partial application. Do NOT `prisma migrate dev` here — the shell
-- is non-interactive; run `prisma migrate deploy` instead. Dev Postgres is on
-- port 5433.

-- ── 1) Movement type / source enums ──────────────────────────────────────────
-- Guarded so a re-run is a no-op (CREATE TYPE has no IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StockMovementType') THEN
    CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StockMovementSource') THEN
    CREATE TYPE "StockMovementSource" AS ENUM ('PO_RECEIPT', 'MR_ISSUE', 'ADJUSTMENT');
  END IF;
END
$$;

-- ── 2) stock_balances table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "stock_balances" (
  "id"          TEXT NOT NULL,
  "company_id"  TEXT NOT NULL,
  "material_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "on_hand"     INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_stock_balances_material_location"
  ON "stock_balances" ("material_id", "location_id");
CREATE INDEX IF NOT EXISTS "idx_stock_balances_company"
  ON "stock_balances" ("company_id");
CREATE INDEX IF NOT EXISTS "idx_stock_balances_location"
  ON "stock_balances" ("location_id");

-- ── 3) stock_movements table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "stock_movements" (
  "id"             TEXT NOT NULL,
  "company_id"     TEXT NOT NULL,
  "material_id"    TEXT NOT NULL,
  "location_id"    TEXT NOT NULL,
  "type"           "StockMovementType" NOT NULL,
  "source"         "StockMovementSource" NOT NULL,
  "quantity"       INTEGER NOT NULL,
  "balance_after"  INTEGER NOT NULL,
  "source_type"    VARCHAR(50),
  "source_id"      TEXT,
  "source_line_id" TEXT,
  "note"           TEXT,
  "created_by_id"  TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_stock_movements_company"
  ON "stock_movements" ("company_id");
CREATE INDEX IF NOT EXISTS "idx_stock_movements_material_location"
  ON "stock_movements" ("material_id", "location_id");
CREATE INDEX IF NOT EXISTS "idx_stock_movements_source"
  ON "stock_movements" ("source_type", "source_id");

-- ── 4) Foreign keys ──────────────────────────────────────────────────────────
-- Guarded with a catalog check since ADD CONSTRAINT has no IF NOT EXISTS.
-- material_id / location_id are RESTRICT (a referenced material/location cannot
-- be deleted while stock rows reference it); company_id RESTRICT; created_by_id
-- SET NULL (keep the ledger row, drop the actor) — mirrors the MR migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_balances_company_id_fkey') THEN
    ALTER TABLE "stock_balances"
      ADD CONSTRAINT "stock_balances_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_balances_material_id_fkey') THEN
    ALTER TABLE "stock_balances"
      ADD CONSTRAINT "stock_balances_material_id_fkey"
      FOREIGN KEY ("material_id") REFERENCES "materials" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_balances_location_id_fkey') THEN
    ALTER TABLE "stock_balances"
      ADD CONSTRAINT "stock_balances_location_id_fkey"
      FOREIGN KEY ("location_id") REFERENCES "project_locations" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_company_id_fkey') THEN
    ALTER TABLE "stock_movements"
      ADD CONSTRAINT "stock_movements_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_material_id_fkey') THEN
    ALTER TABLE "stock_movements"
      ADD CONSTRAINT "stock_movements_material_id_fkey"
      FOREIGN KEY ("material_id") REFERENCES "materials" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_location_id_fkey') THEN
    ALTER TABLE "stock_movements"
      ADD CONSTRAINT "stock_movements_location_id_fkey"
      FOREIGN KEY ("location_id") REFERENCES "project_locations" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_created_by_id_fkey') THEN
    ALTER TABLE "stock_movements"
      ADD CONSTRAINT "stock_movements_created_by_id_fkey"
      FOREIGN KEY ("created_by_id") REFERENCES "users" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
