# Database Migrations

How Forethread manages Postgres schema changes via Prisma Migrate.

## Layout

- **Schema:** `apps/backend/src/prisma/schema/` (multi-file, using Prisma's `prismaSchemaFolder`
  preview feature)
- **Migrations:** `apps/backend/src/prisma/migrations/` — each migration is a folder named
  `<timestamp>_<slug>/` containing a single `migration.sql` file
- **Lock file:** `apps/backend/src/prisma/migrations/migration_lock.toml` — pins the database
  provider (Postgres)

Prisma derives the migrations directory from the schema location, so they live next to the schema,
not at the conventional repo-root `prisma/migrations` path.

## Verified state (2026-05-21)

- 23 migrations on disk, from `20260221172850_init` through `20260326140000_add_quote_attachments`.
- Applied cleanly to an empty Postgres database via `prisma migrate deploy`.
- Resulting schema matches the live `forethread_dev` schema exactly (36 tables, 27 enum types,
  identical column counts across all tables).

## Deploying schema changes

### Local development

```bash
cd apps/backend

# Apply pending migrations
pnpm db:migrate:dev          # prisma migrate dev — creates a new migration if schema has changed

# Seed (after a fresh deploy)
pnpm db:seed                 # loads .env via Node --env-file=.env

# Reset to a clean slate
pnpm db:reset                # drops + re-creates DB, runs all migrations, runs seed
```

### Staging / production

```bash
cd apps/backend

pnpm db:migrate              # prisma migrate deploy — applies pending migrations only, no schema-from-changes
```

`migrate deploy` is non-interactive and safe to run in CI / on boot. It refuses to make schema
changes that aren't in version control.

### Creating a new migration

```bash
# 1. Edit the .prisma files under src/prisma/schema/
# 2. Generate a migration from the diff:
pnpm db:migrate:dev --name <short_slug>

# This creates a new folder under src/prisma/migrations/<timestamp>_<short_slug>/
# Review the generated SQL, commit both the schema change and the migration folder.
```

## Drift detection

`prisma migrate status` reports drift between the schema, the migrations folder, and the connected
database. CI should run this against the production schema URL on every deploy to catch out-of-band
changes.

```bash
pnpm exec prisma migrate status
```

A clean output:

```
N migrations found in src/prisma/migrations

Database schema is up to date!
```

## CI verification

The migration suite should be exercised on every push against an empty database to catch broken
migrations early. Minimum CI step:

```bash
# 1. Spin up a clean Postgres (docker compose, GitHub Actions service, etc.)
# 2. Apply all migrations
pnpm --filter @forethread/backend exec prisma migrate deploy
# 3. (Optional) Run seed and the full test suite
pnpm --filter @forethread/backend db:seed
pnpm --filter @forethread/backend test
```

This was verified locally on 2026-05-21 with a `forethread_migrate_check` scratch DB. Schema
produced by `migrate deploy` matched `forethread_dev` exactly — see FOR-191 for the verification
log.

## Known historical context

Earlier in the project the `_prisma_migrations` table on dev DBs got out of sync with disk state
(entries existed for migrations not yet committed). The repo is now the source of truth; if a dev DB
shows phantom migrations, run `pnpm db:reset` to rebuild from migrations + seed.
