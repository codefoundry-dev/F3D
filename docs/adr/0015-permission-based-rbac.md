# ADR-0015: Permission-based RBAC replaces hard-coded role enum checks

**Status:** Accepted **Date:** 2026-05-21 **Ticket:** FOR-194

## Context

Ayo's third top complaint on the kickoff call was that "the current role system is hard-coded —
there's no way for a Company Admin to assign granular permissions to roles, no configurable approval
limits, no delegation." Before this ticket, every authorisation check in the backend looked like:

```ts
@Roles(UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER)
async approvePo(...) { ... }
```

…which made the role enum part of the API contract. Adding a new role meant editing dozens of
controllers. Changing what a Procurement Officer can do meant editing dozens of controllers. Giving
a _single_ PO at one contractor an extra ability was impossible without code.

The Release 1 plan needs a Company Admin to configure permissions and approval thresholds per role
(the configuration UI itself ships as FOR-195). This ADR locks in the data model and the runtime
check before that UI is built so the contracts are stable.

## Decision

**Two new tables, one new guard, one new decorator.**

### Data model

```prisma
model Permission {
  id          String   @id @default(uuid())
  key         String   @unique     // e.g. "rfq.create", "po.approve"
  description String
  // ...
}

model RolePermission {
  id           String     @id @default(uuid())
  role         UserRole              // existing enum, kept
  permissionId String
  permission   Permission @relation(...)
  @@unique([role, permissionId])
}
```

The `UserRole` Prisma enum **stays** — every user still belongs to exactly one built-in role
(SUPER_ADMIN, COMPANY_ADMIN, PROCUREMENT_OFFICER, FINANCIAL_OFFICER, WAREHOUSE_OFFICER, FOREMAN,
VENDOR). A role is now just a _named bundle of permissions_ rather than a hard-coded set of
capabilities. Removing the enum entirely was considered (see Alternatives) and rejected for
Release 1.

### Catalog as code

The canonical permission catalog lives at
`apps/backend/src/common/permissions/permissions.catalog.ts` — an object literal mapping every key
to its description plus a `ROLE_DEFAULT_PERMISSIONS` map. The catalog is the source of truth. The
database is its persisted projection.

At app startup, `PermissionsBootstrap.onModuleInit` upserts every catalog entry into `permissions`
and `role_permissions`. The bootstrap **never deletes** — Company Admin overrides written by FOR-195
will live in the same `role_permissions` table, so a destructive sync would erase customer
configuration on every deploy.

### Runtime check

A new global `PermissionsGuard` reads `@RequirePermissions('domain.action', …)` metadata via
`Reflector` and queries `RolePermission` on every request:

```ts
@Patch(':id/approve')
@RequirePermissions('po.approve')
async approvePurchaseOrder(...) { ... }
```

The DB query is intentionally not cached. This makes the FOR-195 "revoke a permission and the next
request is denied" requirement free — there is no cache to invalidate. The query is one indexed read
on `(role, permissionId)` so the latency cost is negligible for Release 1's traffic. If profiling
later shows this guard dominates request time, a 30-second TTL cache on the `role → Set<key>` map is
the obvious next step.

### Migration of existing endpoints

Every controller has been rewritten to use `@RequirePermissions` in place of `@Roles`. The legacy
`roles.guard.ts`, `roles.decorator.ts`, and the global `RolesGuard` provider were deleted. The
default role-to-permission mapping in the catalog exactly mirrors the @Roles configuration that
shipped immediately before this ADR — anyone upgrading an existing deployment ends up with identical
authorisation behaviour once the bootstrap runs.

## Consequences

- Authorization is now configurable. FOR-195 wires this to the Company Admin UI and adds the
  per-role permission editor.
- The `UserRole` enum is still the unit a user is assigned to. Custom-named per-company roles (e.g.
  "Senior PO") are _not_ in Release 1; the seven canonical roles are the lever. v2 can add
  `model Role { name, companyId, permissions[] }` without a data migration — `RolePermission.role`
  becomes `roleId`.
- `SUPER_ADMIN` gets every permission via the catalog rather than as a hard-coded bypass. This keeps
  the engine uniform and means a future "support engineer" role with a tighter permission set works
  the same way.
- Data-scoping logic (e.g. "vendors only see their own RFQs") stays in service layers as
  `user.role === UserRole.VENDOR` branches. Those are not authorisation gates — they are filters.
  Replacing them with permissions would mean introducing per-row permissions, which is out of scope
  and probably unnecessary.
- The `ProjectAccessGuard` still uses `user.role` directly for the SuperAdmin bypass and
  CompanyAdmin shortcut. It is a _resource-scoped_ guard (does this user belong to this project?),
  not a _capability_ guard, so the permission catalog doesn't apply.
- Tests stay simple: `PermissionsGuard.spec.ts` covers metadata absence, missing-permission
  rejection, AND-semantics, and the runtime-revocation case. Controller specs continue to mock
  services and don't exercise the guard — the global guard is verified end-to-end via the existing
  e2e suite.

## Alternatives considered

- **Drop the `UserRole` enum entirely; users have an arbitrary `roleId` linking to a `Role` table.**
  Rejected for Release 1. The full closed-list approach (configurable per-company custom roles) is a
  v2 design and adds migration complexity that doesn't pay off until the Company Admin UI ships
  custom-role creation — which is not in scope for Release 1. Keeping `UserRole` as the bundle name
  lets us defer the custom-role table until we actually need it.
- **CASL or another off-the-shelf permission library.** Rejected. The library buys us a query DSL
  and condition evaluation that we don't need — every check in this codebase is a flat boolean "do
  you have this key?" The custom guard is ~30 LOC and reading it tells you exactly what happens.
  CASL would be over-engineering for the current surface.
- **Cache `role → Set<key>` in memory with TTL.** Considered, deferred. The "next request after
  revocation must be denied" requirement makes a naive TTL incorrect, and an invalidation API adds
  complexity that doesn't help anyone today. The DB query is fast. Revisit when measurement shows a
  problem, not before.
- **Seed permissions via raw SQL inside the migration.** Rejected. The catalog grows over time and
  editing INSERTs across multiple migrations is brittle. A startup bootstrap that reads the
  TypeScript catalog keeps the source of truth in one place and makes adding a permission a one-file
  change.
