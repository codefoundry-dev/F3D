# Research: Procurement Platform — Phase 0

**Date**: 2026-02-21 **Branch**: `001-procurement-platform`

All NEEDS CLARIFICATION items from the Technical Context have been resolved. This document records
every architectural decision, rationale, and alternative evaluated before implementation begins.

---

## 1. Turborepo 2.x + pnpm Workspaces (Mixed NestJS + React + React Native)

**Decision**: Turborepo 2.x with pnpm workspaces 9.x. Remote cache via Vercel (cloud default) or
`ducktape/turborepo-remote-cache` (self-hosted S3-backed).

**Rationale**:

- Turborepo 2.x `turbo prune` limits rebuilds to the affected deployment target — critical for
  shipping only the backend without rebuilding the React Native app.
- pnpm enforces strict hoisting that is compatible with Metro bundler (React Native). npm and yarn
  classic over-hoist and break Metro's module resolution.
- Turborepo 2.x task graph hashing is more granular than 1.x and correctly handles Prisma client
  generation (`db:generate`) as a cacheable output.

**Key `turbo.json` tasks**:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".expo/**"] },
    "db:generate": {
      "outputs": ["node_modules/.prisma/**"],
      "inputs": ["prisma/schema.prisma"],
      "cache": true
    },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "lint": { "inputs": ["src/**", "*.ts"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

**React Native / Expo integration**:

- Expo SDK 51+ works in Turborepo without ejecting.
- `apps/foreman-app/metro.config.js` must set `watchFolders` to repo root and
  `resolver.nodeModulesPaths` pointing up to root `node_modules`.
- Use `resolver.unstable_enableSymlinks: true` (Metro 0.80+, included in Expo SDK 51) to handle pnpm
  symlinks correctly.
- Use `eas build --profile development` (not Expo Go) for offline-first features that require
  `expo-background-fetch` and `expo-task-manager`.

**Alternatives rejected**:

| Option         | Reason rejected                                             |
| -------------- | ----------------------------------------------------------- |
| Nx             | More powerful but significantly more configuration overhead |
| Yarn Berry PnP | PnP breaks Metro resolver                                   |
| npm workspaces | Hoisting causes React Native dep conflicts                  |

**Version pins**: `turbo@^2.3.0`, `pnpm@^9.x`

---

## 2. NestJS JWT Authentication with Refresh Tokens

**Decision**: HttpOnly cookies for both tokens in browser apps; Bearer header + `expo-secure-store`
for React Native (foreman-app). Two separate Passport strategies: `JwtStrategy` (access, 15 min) and
`JwtRefreshStrategy` (refresh, 7 days, bound to `/auth/refresh` only). Refresh token rotation: issue
a new refresh token on every `/auth/refresh` call; store only a hash in the DB.

**Rationale**:

- HttpOnly cookies prevent XSS-based token theft. Storing refresh tokens in `localStorage` is a
  known vulnerability.
- Refresh token rotation with DB-stored hash means a compromised DB does not yield usable tokens and
  replay attacks are detected.
- React Native has no HttpOnly cookie security model; `expo-secure-store` maps to iOS Keychain /
  Android Keystore (equivalent security level).

**Cookie configuration (production)**:

```
access_token:  httpOnly, secure, sameSite=lax, path=/, maxAge=15min
refresh_token: httpOnly, secure, sameSite=lax, path=/auth/refresh, maxAge=7d
```

**OTP pattern**:

- 6-digit OTP via `otplib@^12.0.1`; stored as hash in `email_verifications` table (not on `users`
  directly); valid 10 minutes; max 3 attempts before requiring resend.
- Rate-limited via `@nestjs/throttler`.
- JWT is not issued until OTP is verified.

**Correlation IDs via `nestjs-cls`**:

```typescript
ClsModule.forRoot({
  global: true,
  middleware: {
    mount: true,
    generateId: true,
    idGenerator: (req) => req.headers['x-request-id'] ?? randomUUID(),
  },
});
```

Use `ClsService.getId()` in Winston log context to correlate all log lines for a single request.

**Alternatives rejected**:

| Option                        | Reason rejected                              |
| ----------------------------- | -------------------------------------------- |
| Refresh token in localStorage | XSS vulnerability                            |
| express-session               | Adds statefulness; breaks horizontal scaling |

**Version pins**: `@nestjs/jwt@^10.2.0`, `@nestjs/passport@^10.0.3`, `passport-jwt@^4.0.1`,
`nestjs-cls@^4.3.0`, `otplib@^12.0.1`, `argon2@^0.31.2`

---

## 3. Prisma 5.x Multi-Tenant Pattern

**Decision**: Row-level isolation (`company_id` / `tenant_id` on every tenant-scoped table).
Automatic tenant scoping via a **Prisma Client Extension** (not middleware — deprecated in Prisma
5). Soft delete via a separate extension intercepting `delete` calls and converting them to
`update { deletedAt: now() }`.

**Rationale**:

- Schema-per-tenant is operationally expensive: migrations must run against every schema; PgBouncer
  connection pooling becomes complex.
- Prisma 5 deprecated query middleware in favour of type-safe, composable Client Extensions
  (`$extends`).
- Row-level isolation works with a single Prisma schema file, single migration history, and standard
  PgBouncer setup.

**Tenant extension pattern** (created per-request via `nestjs-cls`):

```typescript
function createTenantClient(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          if (['findFirst', 'findMany', 'count'].includes(operation))
            args.where = { ...args.where, tenantId };
          if (operation === 'create') args.data = { ...args.data, tenantId };
          return query(args);
        },
      },
    },
  });
}
```

**Soft delete extension** (intercepts `delete` → converts to `update`):

```typescript
prisma.$extends({
  query: {
    $allModels: {
      async findMany({ args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
      async delete({ args, model }) {
        return (prisma[model] as any).update({
          ...args,
          data: { deletedAt: new Date() },
        });
      },
    },
  },
});
```

**Defense-in-depth**: Enable Postgres RLS policies as a secondary layer. Set `app.current_tenant`
per-transaction via `SET LOCAL` at the database level.

**Alternatives rejected**:

| Option                  | Reason rejected                                       |
| ----------------------- | ----------------------------------------------------- |
| Schema-per-tenant       | Too complex at scale; painful migration orchestration |
| TypeORM                 | Prisma 5 extensions are more type-safe; better DX     |
| Prisma query middleware | Deprecated in Prisma 5                                |

**Version pins**: `prisma@^5.14.0`, `@prisma/client@^5.14.0`

---

## 4. TanStack Query 5 + Zustand State Management Boundary

**Decision**: Strict boundary — TanStack Query 5 owns **all server state**; Zustand owns **all
ephemeral UI state** only. Server data is never put into Zustand.

**Boundary rule**: "Would this state need to be re-fetched if the user opens a new browser tab?" →
YES = TanStack Query. NO = Zustand.

**QueryClient defaults**:

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 minute — don't refetch on every focus
      gcTime: 5 * 60 * 1000, // 5 minutes (replaces cacheTime in TQ5)
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: 0 },
  },
});
```

**Optimistic update pattern (TQ5)**:

1. `onMutate`: cancel in-flight queries → snapshot previous → optimistically update cache.
2. `onError`: roll back to snapshot.
3. `onSettled`: always `invalidateQueries` to sync server truth.

**Zustand usage** (UI state only):

```
✅ Good: modal open/close, selected row IDs, wizard step index, sidebar state
❌ Bad:  users list, RFQ data, invoice records — these belong in TQ cache
```

**Alternatives rejected**:

| Option               | Reason rejected                                                      |
| -------------------- | -------------------------------------------------------------------- |
| Redux Toolkit Query  | Heavier; RTK is better for already-Redux codebases                   |
| SWR                  | Less feature-complete than TQ5 (no mutations, no optimistic updates) |
| All state in Zustand | Re-introduces stale-data problems TQ solves                          |

**Version pins**: `@tanstack/react-query@^5.45.0`, `zustand@^4.5.4`

---

## 5. React Native + Expo Offline-First Architecture

**Decision**: **MMKV** (`react-native-mmkv`) as the offline mutation queue store;
`@react-native-community/netinfo` for connectivity detection; TanStack Query's `onlineManager` for
automatic pause/resume of queries; `expo-background-fetch` + `expo-task-manager` for background
sync.

**Rationale**:

- MMKV is 10–100x faster than AsyncStorage (C++ / JSI-based, synchronous reads). For a mutation
  queue that may grow large (field workers offline for hours), MMKV is the correct choice.
  Compatible with the New Architecture.
- TanStack Query 5's `onlineManager` eliminates the need to manually implement "retry on reconnect"
  logic.
- `expo-background-fetch` runs the queue drain when the app is backgrounded. Note: iOS limits
  background fetch to ~30s; sync tasks must be kept short.

**NetInfo + TQ `onlineManager` integration**:

```typescript
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected && !!state.isInternetReachable);
  });
});
```

**MMKV mutation queue structure**:

```
Key:   "offline_queue"
Value: JSON array of PendingMutation[]

PendingMutation {
  id:         uuid
  endpoint:   string
  method:     POST | PUT | PATCH | DELETE
  payload:    unknown
  createdAt:  ISO-8601
  retryCount: number
}
```

**Conflict resolution**: Include a `client_request_id` (UUID) in every mutation payload so the
server can detect and deduplicate replayed requests.

**Critical**: `expo-background-fetch` does NOT work in Expo Go. A development build via
`eas build --profile development` is required from day 1 for the foreman-app.

**Alternatives rejected**:

| Option        | Reason rejected                                                                     |
| ------------- | ----------------------------------------------------------------------------------- |
| AsyncStorage  | Too slow for large mutation queues                                                  |
| WatermelonDB  | Overkill for a simple mutation queue; appropriate for full relational offline cache |
| Redux Persist | Couples offline queue to Redux                                                      |

**Version pins**: `react-native-mmkv@^2.12.2`, `@react-native-community/netinfo@^11.3.2`,
`expo-background-fetch@^12.0.1`, `expo-task-manager@^11.8.2`, `expo-secure-store@^13.x`

---

## Consolidated Version Pin Table

| Package                           | Version   |
| --------------------------------- | --------- |
| `turbo`                           | `^2.3.0`  |
| `pnpm`                            | `^9.x`    |
| `@nestjs/core`                    | `^10.x`   |
| `@nestjs/jwt`                     | `^10.2.0` |
| `@nestjs/passport`                | `^10.0.3` |
| `passport-jwt`                    | `^4.0.1`  |
| `nestjs-cls`                      | `^4.3.0`  |
| `otplib`                          | `^12.0.1` |
| `argon2`                          | `^0.31.2` |
| `prisma` / `@prisma/client`       | `^5.14.0` |
| `@tanstack/react-query`           | `^5.45.0` |
| `zustand`                         | `^4.5.4`  |
| `react-native-mmkv`               | `^2.12.2` |
| `@react-native-community/netinfo` | `^11.3.2` |
| `expo-background-fetch`           | `^12.0.1` |
| `expo-task-manager`               | `^11.8.2` |
| `expo-secure-store`               | `^13.x`   |

---

## 6. Epic 2 — Project Management Design Decisions

**Date**: 2026-02-23 **Scope**: User Story 2 — Project Creation & Management (Priority: P2)

All decisions below resolve discrepancies between the original data model (drafted for the full
platform) and the projects API contract, and address implementation patterns specific to the
projects module.

---

### 6.1 Project Status Lifecycle

**Decision**: Replace the data model's `Active | Archived` with a four-value enum:
`Planned | Ongoing | Completed | Archived`.

| Status      | Description                                           | Transitions from            |
| ----------- | ----------------------------------------------------- | --------------------------- |
| `Planned`   | Project created; procurement activity not yet started | (initial)                   |
| `Ongoing`   | Active project with procurement activity in progress  | Planned                     |
| `Completed` | Project work finished; documents finalised            | Ongoing                     |
| `Archived`  | Soft-deleted; hidden from default views               | Planned, Ongoing, Completed |

**Rationale**: The original `Active | Archived` was too coarse for business reporting. Users need to
filter by planning vs active vs completed states. The contract's `Planned | Ongoing | Finished` was
adopted with `Completed` replacing `Finished` (more standard terminology) and `Archived` added for
soft-delete.

**Alternatives rejected**:

| Option   | Reason rejected                 |
| -------- | ------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `Active  | Archived` (data model original) | No lifecycle granularity; can't distinguish planned from ongoing |
| `Planned | Ongoing                         | Finished` (contract original)                                    | Missing soft-delete state; `Finished` is non-standard |
| `Draft   | Active                          | Completed                                                        | Archived`                                             | `Draft` implies the project isn't yet visible, which contradicts the spec |

---

### 6.2 Unified Location Model (Delivery + Storage)

**Decision**: Use a single `ProjectLocation` table with a `type` enum (`Delivery | Storage`). Remove
`default_location` (VARCHAR) and `storage_location` (TEXT) from the Project entity — they are
superseded by ProjectLocation records.

The `is_default` uniqueness constraint applies per type per project: exactly one default delivery
location and exactly one default storage location.

**Database enforcement**:

```sql
CREATE UNIQUE INDEX idx_projectlocation_default
  ON project_locations (project_id, type)
  WHERE is_default = true;
```

**Rationale**: Delivery and storage locations share an identical structure (address, label, default
flag). A single table with a type discriminator is simpler than two separate tables and avoids
schema duplication. The partial unique index enforces the business rule at the database level.

**Alternatives rejected**:

| Option                                                                 | Reason rejected                                       |
| ---------------------------------------------------------------------- | ----------------------------------------------------- |
| Separate `ProjectDeliveryLocation` and `ProjectStorageLocation` tables | Schema duplication for identical structure            |
| Single text field per location type on Project                         | Doesn't support multiple locations or structured data |
| JSON array field on Project                                            | Loses referential integrity and indexing              |

---

### 6.3 Project-Scoped Access Control Guard

**Decision**: Implement a `ProjectAccessGuard` as a reusable NestJS guard. The guard reads the
project ID from the route parameter (`:id`), queries the `ProjectMember` join table, and grants
access based on the following hierarchy:

1. **SuperAdmin** — access to all projects (bypass member check)
2. **CompanyAdmin** — access to all projects within their company (bypass member check)
3. **Other roles** — access only if they appear in `ProjectMember` for that project

The guard is applied via `@UseGuards(ProjectAccessGuard)` on individual endpoints or at the
controller level for project-scoped routes.

**Implementation pattern**:

```typescript
@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const projectId = request.params.id;

    if (!projectId) return true; // list endpoints handle scoping in service

    if (user.role === UserRole.SuperAdmin) return true;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    if (user.role === UserRole.CompanyAdmin && user.companyId === project.companyId) return true;

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.sub } },
    });

    if (!membership) throw new ForbiddenException('Not a member of this project');
    return true;
  }
}
```

**Rationale**: Centralising project access checks in a guard prevents each service method from
duplicating the same membership query. The guard is composable with the existing `RolesGuard` —
roles are checked first (by the global guard), then project access is checked (by the route-level
guard).

**Alternatives rejected**:

| Option                                | Reason rejected                                                      |
| ------------------------------------- | -------------------------------------------------------------------- |
| Service-level checks in every method  | Code duplication; easy to forget a check                             |
| Prisma Client Extension (auto-filter) | Too opaque; doesn't throw meaningful HTTP errors                     |
| Middleware                            | Doesn't have access to route metadata; guards are the NestJS pattern |

---

### 6.4 Company-Admin-App Scaffold Strategy

**Decision**: Scaffold `apps/company-admin-app` from scratch following the same patterns established
in `apps/super-admin-app`. The auth feature (login, OTP, activate, forgot/reset password) is adapted
(copy + modify navigation and routing), not extracted to a shared package.

**Tech stack** (identical to super-admin-app):

- React 18.3.x + Vite 5.4.x
- Tailwind CSS 3.4.x (extends `@forethread/config/tailwind` preset)
- TanStack Query 5.x + Zustand 4.x
- React Router 6.x
- React Hook Form + Zod
- `@forethread/api-client` for all HTTP calls
- `@forethread/i18n` for translations

**Key differences from super-admin-app**:

- Side navigation: Dashboard, Projects (not Users/Companies)
- Post-login redirect: Projects list (not Users list)
- Role assumption: CompanyAdmin (not SuperAdmin)
- Vite dev server port: 3002 (super-admin-app uses 3001)

**Rationale**: Premature extraction of shared auth UI into a package adds complexity without
sufficient payoff. When the third app (procurement-officer-app) is scaffolded, the pattern will be
clear enough to evaluate shared extraction.

**Alternatives rejected**:

| Option                                          | Reason rejected                                      |
| ----------------------------------------------- | ---------------------------------------------------- |
| Shared auth package in `packages/`              | Over-engineering for 2 consumers; navigation differs |
| Multi-tenant single app with role-based routing | Violates Constitution VI (independent deployability) |
| Add projects to super-admin-app                 | SuperAdmin doesn't manage projects per spec          |

---

### 6.5 BOM Deferral to Epic 7

**Decision**: Defer Bill of Materials (BOM) implementation to Epic 7 (Material Catalogue
Management). The project detail page in Epic 2 includes a "Bill of Materials" tab that renders an
empty state: "No materials added yet. The Bill of Materials will be available once the material
catalogue is set up."

The `GET /v1/projects/:id/bom` and `POST /v1/projects/:id/bom` endpoints defined in the contract are
NOT implemented in Epic 2. They return 501 Not Implemented if called.

**Rationale**: BOM requires the `Material` entity which is introduced in Epic 7. Implementing BOM
CRUD in Epic 2 would create a hard dependency on the material catalogue, violating the spec's
prioritised delivery order.

---

### 6.6 Seed Data Expansion for Epic 2

**Decision**: Expand `apps/backend/prisma/seed.ts` to include:

- 2 test projects for the seeded contractor company ("Alpha Construction" and "Beta Fitout")
- 3 ProjectLocation records per project (2 delivery, 1 storage; one delivery marked default)
- ProjectMember records assigning the seeded CompanyAdmin and ProcurementOfficer to both projects
- The seeded FinancialOfficer is NOT assigned (for access control testing)

**Rationale**: Seed data should support all verification steps listed in the plan's verification
criteria, including the negative test case (unassigned user gets 403).
