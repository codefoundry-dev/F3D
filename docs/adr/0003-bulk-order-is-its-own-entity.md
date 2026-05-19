# ADR-0003: Bulk Order is its own entity, not a PO variant

**Status:** Accepted
**Date:** 2026-05-12

## Context

The user-requirement document conflates two distinct concepts under "Bulk":
1. A pre-negotiated **price/quantity agreement** with a vendor ("we agreed $10/bag for up to 5,000 bags between July and December").
2. A **standing purchase order** that gets partially fulfilled over time.

These look similar from a distance but have different lifecycles, different approval flows, different reporting needs, and different vendor visibility. Modelling them as one entity ("PO with type=bulk") forces every PO state machine, every approval rule, every dashboard, and every vendor-facing view to branch on type — which is exactly the kind of accidental complexity that the rebuild is meant to escape.

## Decision

A **Bulk Order** is its own first-class entity, representing a price/quantity agreement. It is not a PO and shares no state machine with a PO.

A **PO** has a single uniform lifecycle. It carries an optional `bulk_order_id` foreign key when it was created via a **drawdown**, which inherits price and vendor from the agreement.

Hold-for-release is *not* a third entity — it is a flag on a PO (`not_before` date). Pick-up vs delivery is similarly a flag, not a type.

Vendors only ever see POs (drawdown POs included). They never see the Bulk Order itself; only the Contractor does.

## Consequences

- The PO state machine is simpler: one path, no special cases for bulk.
- "Remaining bulk commitment" becomes a top-level reporting concept across Bulk Orders, not a derived query over a special PO subtype.
- The Bulk Order has its own approval flow (negotiated once, possibly with different sign-off thresholds than a PO).
- Drawdown auto-decrement of remaining quantity becomes a cross-entity invariant the system must enforce — a Bulk Order cannot be drawn down past its ceiling, and editing a child PO's quantity must reconcile against the parent. This is load-bearing logic and needs explicit acceptance tests.
- Amending a Bulk Order (price change, ceiling bump) does *not* retroactively change historical drawdown POs — those are committed once issued. New drawdowns after the amendment use the new terms.
- Reports / dashboards need a `Bulk order view` separate from the PO dashboard (already in the user stories).

## Alternatives considered

- **PO with `type = bulk` variant.** Rejected: pollutes every PO state machine, approval rule, and dashboard with type-branching, and makes the "vendor only sees child" rule awkward (you'd have to hide POs of one type from the vendor while showing others).
- **Bulk Order as a price agreement that auto-generates POs upfront.** Rejected: defeats the point of a frame agreement (commitment without firm delivery dates); also creates phantom POs the vendor sees prematurely.
