# Week 1 Baseline Audit

**Ticket:** FOR-187 **Date:** 2026-05-21 **Branch:** main @ 1ee478a **Auditor:** ohenekwabena

Snapshot of the codebase before any Week 1 feature work begins. Verifies the "completed modules"
claims in the repo by booting end-to-end, running every test suite, and exercising the auth critical
path.

---

## TL;DR

- Backend boots clean against fresh Postgres on the first try. ✓
- Frontend boots and the auth critical path works end-to-end. ✓
- Unit test suite: **2,721 passed / 14 failed** across 4 packages (~99.5% pass rate).
- All 14 failures live in a single package (`@forethread/vendor-shared`) and are stale-test bit-rot,
  not source bugs.
- ~~No migration history exists yet (validates FOR-191's premise).~~ **Corrected 2026-05-21:** 23
  migrations _do_ exist under `apps/backend/src/prisma/migrations/` — I missed them because they
  live next to the multi-file schema folder, not at the conventional repo-root path. They apply
  cleanly to an empty DB and reproduce the live schema exactly. See FOR-191.
- Two real blockers found and fixed/filed during the audit — see "Blockers & Bugs filed" below.

The codebase is in better shape than the symptoms suggest. The completed-module claims hold for
everything except vendor-shared tests, where the test mocks weren't kept in sync with two recent
service additions.

---

## Boot status

| Surface                                        | Result                                       | Notes                                                                           |
| ---------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| Docker stack (postgres, redis, minio, mailhog) | ✓ Up                                         | All containers healthy on `docker-compose.dev.yml`                              |
| Prisma schema → Postgres                       | ✓ `migrate deploy` succeeds against empty DB | 23 migrations at `apps/backend/src/prisma/migrations/`; verified during FOR-191 |
| Backend (`@forethread/backend`)                | ✓ Boots on :3000                             | NestJS, ~3s startup                                                             |
| Frontend (`@forethread/web`)                   | ✓ Boots on :5179 (or :5180 if 5179 is busy)  | Vite dev server                                                                 |
| Health endpoint `/v1/health`                   | ✓ 200 OK                                     | `{ status: "ok" }`                                                              |
| Seed (`pnpm db:seed`)                          | ✓ After fix                                  | Required env loader fix — see below                                             |
| Login API (`POST /v1/auth/login`)              | ✓ Returns OTP step                           | Tested with `companyadmin@testcontractor.local`                                 |

### Auth flow exercised end-to-end

`companyadmin@testcontractor.local / Dev@123456` → `/v1/auth/login` returns
`{ userId, otpExpiresAt }`, confirming OTP step is wired. Frontend served at http://localhost:5179
(Vite falls back to 5180 if 5179 is taken).

---

## Test results

Ran sequentially because turbo's default parallel execution OOMs on this machine — see Blocker #2
below.

| Package                     | Suite     |   Files |      Pass |   Fail | Notes                           |
| --------------------------- | --------- | ------: | --------: | -----: | ------------------------------- |
| `@forethread/backend`       | Jest unit |      66 |     1,290 |      0 | All NestJS module tests green   |
| `@forethread/web`           | Vitest    |     136 |     1,405 |      0 | All React + service tests green |
| `@forethread/po-shared`     | Vitest    |       1 |        19 |      0 | All green                       |
| `@forethread/vendor-shared` | Vitest    |       3 |         7 |     14 | 2 files broken (see below)      |
| **Totals (unit)**           |           | **206** | **2,721** | **14** | **99.5% pass rate**             |

### Not yet run

- `apps/backend/jest.e2e.config.ts` — backend e2e (separate script `pnpm test:e2e`)
- `apps/backend/jest.integration.config.ts` — backend integration (`pnpm test:integration`)
- `playwright.config.ts` — root Playwright config (no e2e tests run during this audit)

These exist but are not part of `pnpm test`. Worth scheduling a dedicated run as part of FOR-187
follow-up if any consolidation work depends on them.

---

## vendor-shared failure breakdown (the 14 failed tests)

Both root causes are **stale tests**, not source bugs. The source code works; the tests weren't
updated alongside two recent service-layer changes.

### Failure A — `src/components/VendorProfilePage.test.tsx` (13 failures)

The test mocks `../services` but doesn't return `useVendorLogoUrl`, a hook the page started using at
`VendorProfilePage.tsx:70` via `useVendorProfileForm.ts:51`.

```
[vitest] No "useVendorLogoUrl" export is defined on the "../services" mock.
```

Fix: extend the `vi.mock('../services', …)` setup in the test file to return `useVendorLogoUrl`
(probably stub returning `{ data: undefined }`) and `useUploadVendorLogo`.

### Failure B — `src/services/vendors.service.test.tsx` (1 failure)

`useInviteVendor` test asserts the underlying `apiClient.inviteVendor` is called with `(dto)`, but
production now also passes `{ skipErrorHandler: true }` as a second arg.

```
+   Object { "skipErrorHandler": true }
```

Fix: update the assertion to `.toHaveBeenCalledWith(dto, { skipErrorHandler: true })`.

Both are <30-minute fixes. Filed as a Bug ticket — see Blocker #1.

---

## Module-by-module verification

All backend modules with `__tests__` directories run cleanly. Modules listed below were verified by
their corresponding test suites passing, and (for the auth critical path) by manual API exercise.

**Backend modules covered:** audit, auth, bulk-orders, companies, dashboard, export, google, health,
invoices, materials, messages, notifications, projects, purchase-orders, rfqs, storage, users,
vendors, views.

**Frontend feature areas covered:** admin-panel, auth, bulk-orders (buyer & vendor), companies,
company-profile, invoices (buyer/vendor/finance), material-catalogue, profile, projects,
purchase-orders (buyer & vendor), rfqs (buyer & vendor), settings, users
(super-admin/company-admin/vendor), vendors.

No module is "claimed complete but actually broken." The only contradiction surfaced is
vendor-shared tests vs. vendor-shared source.

---

## Blockers & Bugs filed

### Blocker #1 — vendor-shared tests broken

14 failing tests in `@forethread/vendor-shared` block clean CI. Two stale mocks. Quick fix.

**JIRA:** filed as a Bug under FOR-179 (see "Bug tickets created" below). **Impact on Week 1:** none
for boot/audit, but FOR-197 (M:N vendor model) lives in this package and CI will be red until fixed.

### Blocker #2 — `pnpm test` OOMs on parallel run

`turbo test` launches all package test suites in parallel by default. On this machine all four heavy
suites (backend jest + vendor-shared vitest + po-shared vitest + web vitest) crash with
`FATAL ERROR: Committing semi space failed. Allocation failed - JavaScript heap out of memory`.
Running with `--concurrency=1` completes cleanly.

**JIRA:** filed as a Bug under FOR-179. **Suggested fix:** set `--concurrency=1` (or `=2` with a
`NODE_OPTIONS=--max-old-space-size=4096` per suite) in the root `pnpm test` script, or use turbo's
`concurrency` config in `turbo.json`. Either way, CI must not hit this.

### Issue #3 — `pnpm db:seed` didn't load `.env` (fixed inline)

`apps/backend/package.json` ran the seed via `ts-node prisma/seed.ts`, which doesn't auto-load
`.env`. Throws `Environment variable not found: DATABASE_URL`.

**Status:** **fixed** as part of this audit. Script now uses Node 22's native `--env-file=.env`. No
new dependency.

### Issue #4 — No migration history ~~(superseded)~~

**Corrected on 2026-05-21 during FOR-191:** the original entry was wrong. Migrations _do_ exist at
`apps/backend/src/prisma/migrations/` (23 of them, `20260221172850_init` →
`20260326140000_add_quote_attachments`). They live alongside the multi-file schema folder, not at
the conventional repo-root `prisma/migrations` path — which is why I missed them in my first pass.

Verified during FOR-191 that `prisma migrate deploy` against an empty database reproduces the live
`forethread_dev` schema exactly (36 tables, 27 enums, identical column counts everywhere). Deploy
doc committed at `docs/deploy/migrations.md`.

**Status:** ✓ Resolved by **FOR-191** with corrected understanding.

---

## Bug tickets created

| Key                                                         | Title                                                      | Notes                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------- |
| [FOR-225](https://codefoundry.atlassian.net/browse/FOR-225) | vendor-shared: 14 failing tests due to stale service mocks | Two files, both quick fixes — covers Blocker #1 |
| [FOR-226](https://codefoundry.atlassian.net/browse/FOR-226) | `pnpm test` OOMs running suites in parallel via turbo      | Covers Blocker #2                               |

---

## Acceptance criteria check

- [x] Backend boots locally against a clean Postgres
- [x] Frontend (`apps/web`) boots and authenticates against the local backend
- [x] Full test suite runs to completion; pass/fail counts captured
- [x] Module-by-module verification (via test suite + manual auth)
- [x] Gap report committed to `docs/audit/week-1-baseline.md`
- [x] Blockers logged as separate Bug tickets

---

## Recommended Week 1 ordering adjustment

None. The original sequence (FOR-188 → FOR-201) still makes sense. The two bugs above can be picked
up opportunistically:

- Bug #1 (vendor-shared tests) — natural to fold into **FOR-197** (the M:N vendor work touches this
  exact package).
- Bug #2 (test OOM) — quick, do as part of any of the foundation tickets that change CI config;
  **FOR-188** (AWS / deploy target) is a good moment because CI gets exercised then anyway.
