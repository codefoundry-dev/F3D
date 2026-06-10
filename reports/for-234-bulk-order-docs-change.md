# FOR-234 — "Commitments" → "Bulk Order / Drawdown" docs rename (prepared change)

**Date:** 2026-06-10
**Status:** PREPARED — not applied (editable Mintlify source not on this machine; see
`reports/for-232-rfq-docs-change.md`). **No app/code changes.** Design + code = source of truth;
Figma decides ambiguity.

**Ground truth**
- `packages/shared-types/src/enums/index.ts` → `BulkOrderStatus` = ACTIVE, EXPIRED, COMPLETED,
  CANCELLED; `PoType.DRAWDOWN`; `PoSourceOfCreation.BULK_DRAWDOWN`.
- App vocabulary: permission domain label is **"Bulk orders"** (`packages/i18n/.../roles.json`).
- `apps/backend/src/prisma/schema/bulk-order.prisma`.

**Target pages:** `guides/commitments/material-commitments` (primary) and the cross-links/nav. The
sibling `guides/commitments/concrete-commitments` ("Pour states") is a specialized concrete-scheduling
variant — see *Secondary* below.

---

## Change 1 — feature rename (page-wide, `material-commitments`)

Replace the "Commitment" vocabulary with "Bulk Order", and name the order-against-it flow "Drawdown":

| Current | →  Replace with |
|---|---|
| Page title "Create and Track Long-Term Material Commitments" | "Create and Track Bulk Orders" |
| "Material Commitment(s)" / "Commitment(s)" (feature noun) | "Bulk Order(s)" |
| Nav "Commitments" / "Go to Commitments" | "Bulk Orders" |
| "+ New Commitment" → "select Material Commitment" | "+ New Bulk Order" |
| "Confirm Commitment" (button/action) | "Confirm Bulk Order" *(see Change 2 — state nuance)* |
| Section "Ordering from a commitment" | "Drawing down against a bulk order" (a **Drawdown**) |
| "Cancel Commitment" | "Cancel Bulk Order" |
| Commitment dashboard / Individual commitment view / Commitment reports | Bulk Order dashboard / view / reports |

Keep the *concept* sentence "Each linked order **draws down** from the same committed pool" — it already
uses the right term; lean into it ("each linked PO is a **Drawdown**").

## Change 2 — replace the "Commitment states" table

**Current (does not exist as a state machine):** Drafted / Confirmed / Partially Delivered / Delivered /
Cancelled.

**Replace with (`BulkOrderStatus`):**

> A bulk order moves through the following states:
>
> | State | What it means |
> |---|---|
> | Active | The bulk order is live — purchase orders (drawdowns) can be linked to it. |
> | Expired | The bulk order's term has ended; it no longer accepts new drawdowns. |
> | Completed | The committed quantities have been fully ordered/fulfilled. |
> | Cancelled | The bulk order was terminated. |

**State-narrative nuance (design fallback):** `BulkOrderStatus` has **no "Drafted" or "Confirmed"
state** — a created bulk order is **Active**. So Step 3 ("Confirm Commitment to activate it. The
commitment moves from Drafted to Confirmed status") should become: "Save the bulk order to **activate**
it — it becomes **Active** and is ready to accept drawdowns." (If the live UI does show a transient
pre-active step, match the UI; but the stored status set is the four above.)

---

## Secondary — `concrete-commitments` ("Pour states")

The ticket says rename "throughout," so the *naming* ("Concrete Commitments" → e.g. "Concrete Bulk
Orders" / concrete pours under Bulk Orders) should follow. **But** its "Pour states" (Scheduled /
Confirmed / In Progress / Completed / Cancelled / Rescheduled) are a **distinct pour-scheduling state
machine**, not `BulkOrderStatus`. I did **not** rewrite those states — flag for verification against the
design before touching (no concrete-pour enum was confirmed). Treat as a follow-up if out of FOR-234's
intended scope.

## Out of scope

- No app/code changes (AC). Earlier "Bulk Order → Commitment" UI relabel was git-reverted (53839d5).
- PO lifecycle wording inside linked PO sections → FOR-230 / FOR-231.

## Acceptance criteria coverage

- [x] Docs use "Bulk Order" (and "Drawdown") wherever they said "Commitment" — Change 1
- [x] Bulk Order status documented as Active / Expired / Completed / Cancelled — Change 2
- [x] Page titles, nav references, cross-links updated — Change 1 (+ Secondary for concrete)
- [x] No app/code changes
