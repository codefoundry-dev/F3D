# Quickstart: Procurement Platform

**Purpose**: End-to-end verification of the development environment and core
platform workflows. Run these steps after initial setup to confirm everything is
working correctly.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20.x LTS | https://nodejs.org |
| pnpm | 9.x | `npm install -g pnpm@9` |
| Docker + Docker Compose | 25.x | https://docker.com |
| PostgreSQL | 16.x | via Docker (see below) |
| Redis | 7.x | via Docker (see below) |

---

## 1. Clone and Bootstrap

```bash
git clone <repository-url>
cd project-forethread

# Install all workspace dependencies
pnpm install

# Verify Turborepo is working
pnpm turbo --version
```

---

## 2. Environment Setup

```bash
# Copy environment templates for all apps
cp apps/backend/.env.example apps/backend/.env
cp apps/super-admin-app/.env.example apps/super-admin-app/.env
cp apps/company-admin-app/.env.example apps/company-admin-app/.env
cp apps/procurement-officer-app/.env.example apps/procurement-officer-app/.env
cp apps/financial-officer-app/.env.example apps/financial-officer-app/.env
cp apps/warehouse-officer-app/.env.example apps/warehouse-officer-app/.env
cp apps/vendor-app/.env.example apps/vendor-app/.env
```

**Minimum required environment variables for `apps/backend/.env`**:
```env
# Database
DATABASE_URL=postgresql://forethread:forethread@localhost:5432/forethread_dev

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=your-local-dev-access-secret-min-32-chars
JWT_REFRESH_SECRET=your-local-dev-refresh-secret-min-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Email (use Mailhog for local dev)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@forethread.local

# S3 (use MinIO for local dev)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=forethread-dev

# Observability
SENTRY_DSN=             # Leave empty for local dev
LOG_LEVEL=debug

# App
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000
```

---

## 3. Start Infrastructure Services

```bash
# Start PostgreSQL, Redis, Mailhog, MinIO via Docker Compose
docker compose -f docker-compose.dev.yml up -d

# Verify services are healthy
docker compose -f docker-compose.dev.yml ps
```

**docker-compose.dev.yml services**:
- `postgres` — PostgreSQL 16 on port 5432
- `redis` — Redis 7 on port 6379
- `mailhog` — SMTP/web UI on ports 1025 (SMTP) / 8025 (web)
- `minio` — S3-compatible storage on ports 9000/9001

---

## 4. Database Setup

```bash
cd apps/backend

# Run Prisma migrations
pnpm prisma migrate dev --name init

# Seed development data (Super Admin + test companies + users)
pnpm prisma db seed

# Verify: open Prisma Studio
pnpm prisma studio
```

**Seed data provides**:
- Super Admin: `superadmin@forethread.local` / `Dev@123456`
- Contractor Company Admin: `admin@contractor.local` / `Dev@123456`
- Procurement Officer: `procurement@contractor.local` / `Dev@123456`
- Financial Officer: `finance@contractor.local` / `Dev@123456`
- Vendor: `vendor@testvendor.local` / `Dev@123456`

---

## 5. Start Development Servers

```bash
# From repo root — start backend + all web apps in parallel
pnpm dev

# Or start only specific apps:
pnpm turbo dev --filter=backend
pnpm turbo dev --filter=procurement-officer-app
pnpm turbo dev --filter=vendor-app
```

**Default dev ports**:
| App | URL |
|---|---|
| Backend API | http://localhost:3000 |
| Swagger UI | http://localhost:3000/api |
| super-admin-app | http://localhost:3001 |
| company-admin-app | http://localhost:3002 |
| procurement-officer-app | http://localhost:3003 |
| financial-officer-app | http://localhost:3004 |
| warehouse-officer-app | http://localhost:3005 |
| vendor-app | http://localhost:3006 |
| Mailhog UI | http://localhost:8025 |
| MinIO Console | http://localhost:9001 |

---

## 6. Verification: Core Workflow Walkthrough

Run through this sequence to confirm the platform is working end-to-end.

### Step 1 — Super Admin creates users

1. Open http://localhost:3001 and log in as `superadmin@forethread.local`.
2. Navigate to Users → Create User.
3. Create a new Procurement Officer for the seeded contractor company.
4. Open Mailhog (http://localhost:8025) and verify the invitation email arrived.

### Step 2 — User activates account

1. Click the invitation link in Mailhog.
2. Set a password on the activation page.
3. Verify you are redirected to the login page.
4. Log in with the new credentials and complete OTP (check Mailhog for OTP email).
5. Confirm the Procurement Officer dashboard loads.

### Step 3 — Create a project and add materials

1. Log in as `procurement@contractor.local` to http://localhost:3003.
2. Create a project named "Test Project Alpha" with one location.
3. Open the Material Catalogue and add 3 test materials.
4. Create a BOM for the project using the 3 materials.

### Step 4 — Create and send an RFQ

1. Still as Procurement Officer, create a new RFQ from the project BOM.
2. Select the seeded vendor as the recipient.
3. Send the RFQ.
4. Open Mailhog — verify the vendor received an invitation email with RFQ details.

### Step 5 — Vendor submits a quote

1. Open the quote link from the Mailhog email (or log in as `vendor@testvendor.local`
   to http://localhost:3006).
2. Submit a quote with prices and delivery dates for all line items.

### Step 6 — Review and approve quote → create PO

1. Log back in as Procurement Officer (http://localhost:3003).
2. Open the RFQ dashboard — verify the vendor's quote appears.
3. Open the comparison view and approve all line items.
4. Convert the approved quote to a Purchase Order.
5. Issue the PO.
6. Open Mailhog — verify the vendor received PO notification.

### Step 7 — Upload and reconcile an invoice

1. Log in as Financial Officer (`finance@contractor.local`) to http://localhost:3004.
2. Upload a test PDF invoice against the PO.
3. Review the extracted data (or manually enter if OCR is not configured locally).
4. Initiate reconciliation.
5. Approve all line items.
6. Approve the invoice.
7. Verify the invoice shows `status: Approved`.

---

## 7. Run Tests

```bash
# Run all tests across the monorepo
pnpm test

# Run tests for a specific package
pnpm turbo test --filter=backend
pnpm turbo test --filter=shared-types

# Run with coverage report
pnpm turbo test:coverage --filter=backend

# Run integration tests only
cd apps/backend && pnpm test:integration

# Run contract tests
cd apps/backend && pnpm test:contract
```

**Coverage threshold**: 90% enforced. A failed coverage check fails the CI pipeline.

---

## 8. Type Checking

```bash
# Type-check all packages
pnpm typecheck

# Type-check a single package
pnpm turbo typecheck --filter=backend
```

---

## 9. Linting & Formatting

```bash
# Lint all packages
pnpm lint

# Fix auto-fixable lint issues
pnpm lint:fix

# Format all files
pnpm format
```

---

## 10. Build for Production

```bash
# Build all apps (uses Turborepo incremental build cache)
pnpm build

# Build a single app
pnpm turbo build --filter=backend
pnpm turbo build --filter=procurement-officer-app

# Build Docker images
docker build -t forethread-backend:local apps/backend
docker build -t forethread-procurement-app:local apps/procurement-officer-app
```

---

## 11. CI/CD Pipeline Overview

GitHub Actions workflows (`.github/workflows/`):

```
ci.yml — Runs on all PRs:
  jobs:
    lint          → pnpm lint (all packages, fails on any warning)
    typecheck     → pnpm typecheck (all packages, fails on any error)
    test          → pnpm test:coverage (fails if coverage < 90%)
    build         → pnpm build (fails if any app fails to build)

docker.yml — Runs on merge to main/staging/production:
  jobs:
    build-images  → docker build each app
    push-registry → push to container registry
    deploy        → trigger environment deployment
```

**Branch environments**:
- `feature/*` → CI only (lint + typecheck + test + build)
- `main` → auto-deploy to `dev` environment
- `staging` → auto-deploy to `staging` environment
- `production` → manual approval + deploy to `production`

---

## 12. Troubleshooting

| Problem | Solution |
|---|---|
| `pnpm install` fails | Ensure pnpm 9.x is installed: `pnpm --version` |
| Database connection refused | Run `docker compose -f docker-compose.dev.yml up -d postgres` |
| Prisma migration fails | Run `pnpm prisma migrate reset --force` (WARNING: drops all data) |
| OTP email not received | Check Mailhog at http://localhost:8025 |
| Type errors after pulling | Run `pnpm install && pnpm typecheck` |
| Port already in use | Check `lsof -i :3000` and kill conflicting process |
| Turborepo cache issues | Run `pnpm turbo clean` to clear local cache |
