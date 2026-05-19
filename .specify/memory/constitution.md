<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0
Bump rationale: MINOR — two new principles added (IX, X).

Modified principles: None (existing I–VIII unchanged)

Added sections:
  - IX. Design Token Management (colors, fonts, spacing as variables)
  - X. Internationalisation (i18n) (all user-facing text in translation files)

Removed sections: None

Templates reviewed:
  - .specify/templates/plan-template.md ✅ aligned (Constitution Check gate
    present; no design-token or i18n specific gates needed at plan level)
  - .specify/templates/spec-template.md ✅ aligned (functional requirements
    section can capture i18n and theming needs per feature)
  - .specify/templates/tasks-template.md ✅ aligned (Polish phase covers
    cross-cutting concerns where i18n audit and token extraction fit)
  - .specify/templates/agent-file-template.md ✅ aligned (technology slots
    unchanged; i18n library choice recorded in Technology Stack below)
  - .specify/templates/checklist-template.md ✅ aligned (checklist generator
    can produce i18n and design-token checklists on demand)
  - .specify/templates/constitution-template.md ✅ source of structure
    (read-only)

Deferred TODOs: None — all placeholders resolved.
-->

# Forethread Constitution

## Core Principles

### I. Monorepo-First Architecture

The entire system MUST live in a single production-grade monorepo managed with **Turborepo**
(preferred) or Nx for task orchestration and **pnpm workspaces** for dependency management. Every
app and package MUST be independently buildable and testable in isolation.

- Monorepo tooling MUST provide incremental builds and remote caching.
- pnpm workspaces MUST be the sole package manager; npm and yarn are prohibited.
- All apps reside under `/apps/`; all shared libraries under `/packages/`.
- A package MUST NOT import from an app (no reverse dependencies).
- Repository structure MUST match:

```
/apps
  /backend               # NestJS API
  /super-admin-app       # Web — platform administration
  /company-admin-app     # Web — contractor company management
  /procurement-officer-app  # Web — procurement workflows
  /financial-officer-app    # Web — invoicing & financial reporting
  /warehouse-officer-app    # Web (tablet-optimised) — inventory & goods receipt
  /vendor-app            # Web — vendor onboarding & order tracking
  /foreman-app           # React Native — field operations (iOS + Android)

/packages
  /ui-components         # Shared React UI library (Storybook, WCAG)
  /shared-types          # DTOs, enums, Zod schemas, API contracts
  /api-client            # Typed Axios client consumed by all apps
  /config                # Shared environment constants
  /eslint-config         # Shared ESLint ruleset
  /i18n                  # Shared translation files and i18n utilities
```

**Rationale**: A single monorepo eliminates version drift between packages, enforces shared
contracts, and enables atomic cross-package refactors.

### II. Clean Architecture & SOLID

Both the backend and all frontend applications MUST follow **Clean Architecture** (dependency rule:
domain → application → infrastructure, never reversed) and SOLID principles.

Backend (NestJS) non-negotiable rules:

- Business logic MUST reside in service classes; controllers MUST only parse requests and delegate.
- Services MUST be stateless; no request-scoped mutable state in services.
- Cross-cutting concerns MUST use Guards (auth/RBAC), Interceptors (logging, transformation), Pipes
  (validation), and Exception Filters (error normalisation).
- Custom decorators MUST be used for repetitive metadata concerns (roles, current user, etc.).
- Modules MUST be domain-driven; a module boundary MUST map to a business domain (e.g., `users`,
  `procurement`, `invoicing`).

Frontend (React) non-negotiable rules:

- Feature folders MUST separate: `ui/` (components), `state/` (Zustand stores), `services/` (API
  calls via api-client), `hooks/` (custom hooks), `domain/` (models).
- No business rules MUST be hardcoded in UI components.
- Business logic MUST NOT leak into JSX render functions.

**Rationale**: Clean boundaries make the system testable in isolation, maintainable as the team
scales, and refactorable without full rewrites.

### III. Strict Type Safety (NON-NEGOTIABLE)

TypeScript strict mode MUST be enabled in every package and app. Zero `any` is the enforced
standard.

- `tsconfig.json` with `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true` MUST be
  shared from `/packages/config`.
- `/packages/shared-types` is the **single source of truth** for all DTOs, enums, API response
  shapes, and Zod validation schemas.
- No type assertion (`as SomeType`) is permitted without an inline justification comment reviewed in
  PR.
- Barrel exports (`index.ts`) MUST be used at package boundaries.
- CI MUST run `tsc --noEmit` on every package; type errors block merge.

**Rationale**: Shared types eliminate contract drift between frontend and backend. Strict mode
catches entire classes of runtime bugs at compile time.

### IV. Security by Design

Security controls MUST be applied at the framework layer, not ad-hoc per endpoint.

- Authentication: JWT (access + refresh token pattern) enforced via a global Auth Guard; all routes
  are protected by default; public routes MUST be explicitly marked.
- Authorisation: Role-Based Access Control (RBAC) via NestJS role guards using roles defined in
  `/packages/shared-types`; role checks MUST never live in service logic.
- Rate limiting MUST be applied globally with configurable per-route overrides.
- CORS MUST be explicitly configured; wildcard origins (`*`) are prohibited in staging and
  production.
- `helmet` middleware MUST be mounted globally on the NestJS app.
- All incoming data MUST be validated via `class-validator` DTOs before reaching service logic; raw
  request bodies MUST never be passed to services.
- Secrets MUST be injected via environment variables; no secrets in source code or committed config
  files.

**Rationale**: Security controls embedded at the framework level are harder to accidentally bypass
than per-endpoint implementations.

### V. Testing Discipline

All packages and apps MUST include automated tests. The test suite is a first-class deliverable, not
an afterthought.

- Unit tests (Jest) are REQUIRED for all service classes, utility functions, and Zustand stores.
- Integration tests are REQUIRED for all API endpoints and cross-module interactions.
- **Minimum 90% code coverage is enforced in CI** — PRs that drop coverage below this threshold MUST
  NOT be merged.
- Contract tests MUST validate `/packages/shared-types` schemas against real API responses.
- Frontend component tests MUST use React Testing Library.
- The foreman-app (React Native) MUST include Jest + Detox E2E tests for critical offline-first
  flows.
- Tests MUST be co-located with source files or in a sibling `__tests__/` directory.

**Rationale**: 90% coverage with meaningful integration tests provides a regression safety net
sufficient for a production procurement system with financial and legal consequences.

### VI. Independent Deployability

Every application MUST be deployable independently without touching other apps.

- Each app MUST have its own multi-stage `Dockerfile` producing a production-optimised image.
- Apps MUST be reachable under distinct URLs (e.g., `api.`, `admin.`, `vendor.`, `warehouse.`
  subdomains).
- The backend MUST be stateless; session state MUST NOT be stored in memory.
- All configuration MUST be injected via environment variables (Twelve-Factor App compliance).
- Health check (`/health`), readiness (`/ready`), and liveness (`/live`) endpoints MUST be present
  on the backend.
- CI/CD MUST use GitHub Actions with three branch environments: `dev`, `staging`, `production`.
- Pipeline stages MUST run in order: lint → type-check → test (with coverage) → build → Docker image
  → push to registry.
- Frontend apps MUST use lazy loading and code splitting; no unneeded bundle weight.

**Rationale**: Independent deployability allows teams to ship, roll back, and scale individual apps
without coordinating a full-platform release.

### VII. Observability-First

Every service MUST emit actionable signals for debugging, alerting, and capacity planning from day
one.

- Structured logging (JSON format) MUST be implemented via **Winston** or **Pino** on the backend;
  plain `console.log` is prohibited in production code.
- All log entries MUST include: timestamp, level, service name, correlation/request ID, and relevant
  context (user ID, resource ID).
- Error monitoring MUST be Sentry-compatible (SDK integrated, DSN via env var).
- A Prometheus-compatible `/metrics` endpoint MUST be exposed by the backend.
- Frontend apps MUST integrate Sentry for uncaught exception capture.
- System logs MUST be immutable and MUST NOT be deleted by application logic (per FRD requirement).

**Rationale**: Observability is not optional in a procurement platform where financial documents are
processed; undiagnosed failures have legal and financial consequences.

### VIII. Shared-Before-Custom

Code that can be shared MUST be shared. Duplication of logic across app boundaries is prohibited.

- UI components used by more than one app MUST live in `/packages/ui-components`, be documented in
  Storybook, meet WCAG accessibility standards, and contain zero business logic.
- All API request/response types MUST be defined in `/packages/shared-types` before being used in
  any app.
- All apps MUST consume the backend exclusively through `/packages/api-client` (typed Axios client
  with centralised token management and error handling); direct `fetch` or raw Axios usage in app
  code is prohibited.
- `/packages/ui-components` MUST NOT import from any app or from `api-client`.
- Shared packages MUST be published to a private registry for consumption; direct workspace symlinks
  are acceptable during local development only.

**Rationale**: Centralised contracts and UI eliminate the divergence that plagues multi-app
platforms and reduce the surface area for bugs at integration points.

### IX. Design Token Management

All visual styling properties MUST be defined as variables (design tokens) in a centralised theme
layer. Hardcoding raw colour values, font families, font sizes, spacing scales, border radii,
shadows, or breakpoints directly in component code is prohibited.

Web frontend apps (React + Tailwind CSS):

- A shared Tailwind theme configuration MUST be maintained in `/packages/config` (or
  `/packages/ui-components`) and consumed by every web app.
- All colours MUST be defined as CSS custom properties (e.g., `--color-primary`) or Tailwind
  `theme.extend` tokens; raw hex/rgb/hsl values in component files are prohibited.
- All font families and font sizes MUST be defined as Tailwind theme tokens or CSS custom
  properties; inline `font-family` or arbitrary `text-[16px]` values are prohibited unless mapped to
  a named token.
- Spacing, border-radius, and shadow values MUST reference the shared scale; magic numbers are
  prohibited.
- Theme tokens MUST support light/dark mode variants where applicable via CSS custom properties or
  Tailwind's `dark:` variant bound to token values.

Mobile app (React Native — foreman-app):

- A shared theme object MUST be maintained (e.g., `theme.ts`) exporting all colours, typography
  scales, and spacing constants as named variables.
- Direct use of hardcoded colour strings (e.g., `color: '#FF0000'`) in StyleSheet definitions or
  inline styles is prohibited; all values MUST reference the theme object.

Enforcement:

- ESLint rules (e.g., `no-restricted-syntax` or a custom plugin) SHOULD flag raw colour/font
  literals in TSX/JSX files.
- PR reviews MUST reject hardcoded visual values that bypass the token system.

**Rationale**: Centralised design tokens enable consistent theming across all apps, simplify brand
updates and dark-mode support, and prevent visual drift between independently developed
applications.

### X. Internationalisation (i18n)

Every user-facing text string MUST be externalised into translation files. No human-readable text
that is displayed to end users is permitted as a hardcoded string literal in source code.

Infrastructure:

- A shared `/packages/i18n` package MUST contain all translation JSON files (e.g., `en.json`,
  `ar.json`) organised by namespace/feature.
- Web apps MUST use **react-i18next** (or an equivalent i18n library compatible with React) to load
  and render translations.
- The foreman-app (React Native) MUST use **react-i18next** (or **react-native-i18n**) for the same
  purpose.
- The backend MUST externalise all user-facing messages (validation errors, email templates,
  notification text) into a translatable format; error codes MUST be returned to clients alongside
  localised messages resolved on the frontend.

Non-negotiable rules:

- All UI labels, button text, headings, placeholders, tooltips, error messages, success messages,
  and any other text rendered to the user MUST use a translation key (e.g.,
  `t('procurement.submitButton')`), never a raw string.
- Translation keys MUST follow a hierarchical dot-notation namespace matching the feature structure
  (e.g., `auth.login.emailLabel`, `procurement.order.statusPending`).
- A default locale (English) MUST always be complete; missing keys MUST fall back to the default
  locale, never render raw keys to users.
- Adding a new user-facing string without a corresponding translation key MUST be flagged in code
  review and rejected.
- `/packages/i18n` MUST export a typed helper or generated type map so that translation keys are
  type-checked at compile time (e.g., via `i18next-resources-to-backend` or a code-generated enum).

Enforcement:

- ESLint rules (e.g., `react/jsx-no-literals` or a custom plugin) SHOULD flag raw string literals
  inside JSX that are not wrapped in a translation function.
- CI MUST validate that no translation key used in code is missing from the default locale file.

**Rationale**: Externalising text from day one avoids expensive retrofitting, enables future
multi-language support (critical for a procurement platform operating across regions), and ensures
consistent terminology across all apps.

## Technology Stack

### Backend — `/apps/backend`

| Concern           | Choice                             |
| ----------------- | ---------------------------------- |
| Framework         | NestJS (latest LTS)                |
| Language          | TypeScript (strict mode)           |
| Database          | PostgreSQL                         |
| ORM               | Prisma (preferred)                 |
| API documentation | Swagger / OpenAPI                  |
| Logging           | Winston or Pino                    |
| Testing           | Jest (unit + integration)          |
| Containerisation  | Docker (multi-stage)               |
| API versioning    | `/v1` prefix on all routes         |
| Response format   | `{ success, data, error?, meta? }` |

### Web Frontend Apps (all except foreman-app)

| Concern          | Choice                                 |
| ---------------- | -------------------------------------- |
| Framework        | React.js (latest stable)               |
| Language         | TypeScript (strict mode)               |
| Styling          | Tailwind CSS                           |
| Design tokens    | CSS custom properties + Tailwind theme |
| State management | Zustand                                |
| Data fetching    | TanStack Query (React Query)           |
| i18n             | react-i18next                          |
| Testing          | Jest + React Testing Library           |

### Mobile App — `/apps/foreman-app`

| Concern            | Choice                                |
| ------------------ | ------------------------------------- |
| Framework          | React Native                          |
| Language           | TypeScript (strict mode)              |
| State management   | Zustand                               |
| Design tokens      | Shared theme object (`theme.ts`)      |
| i18n               | react-i18next                         |
| Offline support    | Required (offline-first architecture) |
| Push notifications | Required                              |
| CI builds          | Fastlane (Android + iOS)              |

### Shared Packages

| Package                   | Responsibility                                       |
| ------------------------- | ---------------------------------------------------- |
| `/packages/ui-components` | Reusable React components; Storybook; WCAG           |
| `/packages/shared-types`  | DTOs, enums, Zod schemas, API contracts              |
| `/packages/api-client`    | Typed Axios client; token management; error handling |
| `/packages/config`        | Shared env constants; Tailwind theme; configuration  |
| `/packages/eslint-config` | Shared ESLint ruleset (strict)                       |
| `/packages/i18n`          | Translation files; typed key helpers; locale utils   |

## Code Quality Standards

The following standards are non-negotiable and enforced by tooling:

**Tooling (enforced pre-commit via Husky):**

- ESLint with strict rules from `/packages/eslint-config` — zero warnings policy.
- Prettier for formatting — no deviations.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).
- TypeScript compilation check (`tsc --noEmit`) runs before commit on changed packages.

**Design rules:**

- DRY (Don't Repeat Yourself): identical logic MUST NOT exist in more than one package.
- SRP (Single Responsibility): each module, service, and component MUST have one reason to change.
- Dependency Injection MUST be used on the backend (NestJS IoC container).
- No hardcoded business rules in UI layers.
- No hardcoded visual values (colours, fonts, spacing) in component files — all MUST reference
  design tokens (see Principle IX).
- No hardcoded user-facing text in source code — all MUST use i18n translation keys (see Principle
  X).
- Feature-based folder structure MUST be used in all apps (group by feature, not by file type).
- Barrel exports (`index.ts`) at every public package/module boundary.

**Performance:**

- Frontend apps MUST use React lazy loading and route-level code splitting.
- Backend MUST paginate all list endpoints; unbounded queries are prohibited.
- Database indexes MUST be defined alongside schema migrations.
- Redis caching layer MUST be designed for (connection-ready) even if not initially populated.
- The backend MUST be stateless and horizontally scalable by design.

## Governance

This constitution supersedes all other development practices, ADRs, or verbal agreements. When a
conflict exists between this document and any other guideline, this constitution takes precedence.

**Amendment procedure:**

1. Open a PR with changes to `.specify/memory/constitution.md`.
2. Bump `CONSTITUTION_VERSION` following semantic versioning:
   - MAJOR — removal or backward-incompatible redefinition of a principle.
   - MINOR — new principle or section added, or materially expanded guidance.
   - PATCH — clarification, wording fix, or non-semantic refinement.
3. Update `LAST_AMENDED_DATE` to the date of merge.
4. Propagate changes to affected `.specify/templates/` files in the same PR.
5. At least one other team member MUST review constitutional changes.

**Compliance:**

- All PRs MUST pass the CI pipeline (lint, type-check, test, coverage >= 90%, build).
- The `Constitution Check` gate in `plan.md` MUST be completed before implementation begins on any
  feature.
- Violations of hard constraints (e.g., `any` usage, business logic in controllers, skipped tests,
  hardcoded colours, raw user-facing strings) MUST be flagged in code review and corrected before
  merge.

**Version**: 1.1.0 | **Ratified**: 2026-02-21 | **Last Amended**: 2026-02-23
