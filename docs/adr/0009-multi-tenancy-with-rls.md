# ADR-0009: Shared-DB multi-tenancy with Postgres row-level security

**Status:** Accepted
**Date:** 2026-05-12

## Context

The data isolation requirement is shaped by four facts:

1. Contractors are tenants and must not see each other's data — POs, RFQs, vendor lists, prices, invoices.
2. The public catalogue is platform-wide: read by everyone, written by Super Admin only.
3. Super Admin has cross-tenant reads (system health, unmatched invoices, public catalogue management).
4. The same Vendor email may exist under many Contractors as independent records.

The classical options:
- **Shared DB + application-level filter** — cheapest, most flexible, but one missed `WHERE contractor_id = ?` is a cross-tenant leak. The bug is *opt-in to safety*, which is exactly the wrong default for a security-critical filter.
- **Schema-per-tenant** — stronger isolation, but cross-tenant operations become awkward (UNIONs over schemas, dynamic schema-set switches), and migrations multiply by tenant count.
- **DB-per-tenant** — strongest isolation, but ops complexity is unjustified at the scale of this product for the foreseeable future. Super Admin queries become an analytics-warehouse problem.
- **Shared DB + Postgres Row-Level Security (RLS)** — same physical model as the first option, but the database enforces tenancy. A missed filter fails closed.

## Decision

Single Postgres database. Single schema. Every Contractor-scoped table carries `contractor_id`. RLS policies are attached to those tables and reference a `current_contractor_id` GUC (`SET LOCAL ...`) that the application sets at the start of every transaction. Application code may still filter explicitly, but it does not *need* to — RLS guarantees isolation.

- **Tenant resolution middleware**: every authenticated request resolves `current_contractor_id` from the session (user → contractor_id) or action token (token → contractor_id) before opening the transaction. There is no code path that opens a Contractor-scoped transaction without a resolved tenant.
- **Super Admin** logs in to a separate identity domain. Super Admin sessions use a dedicated DB role (`super_admin`) that has `BYPASSRLS`. Every Super-Admin DB session is logged with the actor's user ID and the rationale for the cross-tenant read.
- **Public catalogue tables** carry no `contractor_id` and no RLS policy; standard Postgres permissions grant read to all and write to the Super Admin role only.
- **Promotion of a private catalogue item to public** is a *copy* operation, not a move. The private row is retained; existing references to it are unaffected. New procurement documents within the Contractor that proposed the promotion reference the *public* item ID going forward; this is enforced at item-pick time in the UI by preferring the public match when both exist.
- **Action tokens** (ADR-0002) encode `contractor_id` and `vendor_id`. The token-validation middleware sets `current_contractor_id` from the token before any handler runs.

## Consequences

- **Failure mode for a missing filter is empty results, not a leak.** This is the most important property of the design.
- **Migrations are single-target**, run once. Cost stays low as tenant count grows.
- **Reporting / analytics across tenants** for the Super Admin is straightforward — they're querying the same DB with the bypass role. No data warehouse needed for v1.
- **RLS policies must be maintained alongside table definitions.** Every new Contractor-scoped table requires a policy in the same migration. We adopt a CI check that fails the build if a new table lacks an RLS policy or an explicit "this is platform-wide" annotation.
- **Test data isolation in test runs** depends on either issuing fresh `contractor_id`s per test or running migrations + truncations carefully. A shared DB with RLS is friendly to this — most tests just `SET LOCAL current_contractor_id` per test.
- **GUC misuse risk:** a developer who forgets `SET LOCAL` could leak rows within a single connection over the wire. Mitigation: the middleware always issues `SET LOCAL` inside a fresh `BEGIN`, and the pool returns connections with the GUC unset.
- **Promotion-as-copy** means price history under the private item ID doesn't follow into the public item — the public item starts fresh. This is intentional: public price history must be representative across Contractors, not anchored to one Contractor's purchases.
- **Same Vendor email in N Contractors = N rows** is deliberate. We do *not* introduce a global Vendor identity; the rebuild's design pivot away from a shared vendor pool depends on this.

## Alternatives considered

- **Application-level filtering only.** Rejected: one missed WHERE clause is a P0 incident.
- **Schema-per-tenant.** Rejected: cross-tenant Super Admin queries get awkward, migrations multiply by tenant count, and the isolation gain over RLS is marginal for the threat model here.
- **DB-per-tenant.** Rejected: ops complexity unjustified at expected scale; analytics across tenants becomes its own infrastructure problem.
- **Globally-shared Vendor identity.** Rejected: violates the meeting's design pivot away from a shared vendor pool. Also breaks the "Contractor controls their own vendor list" property of [ADR-0001].
