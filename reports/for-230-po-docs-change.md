# FOR-230 — Purchase Order status & approval model docs correction (prepared change)

**Date:** 2026-06-10
**Status:** PREPARED — not applied (editable Mintlify source not on this machine; see
`reports/for-232-rfq-docs-change.md` for the access situation). Apply in the docs source / Mintlify
editor.
**Direction:** design + code = source of truth; docs change to match. **No app/code changes.** Where
docs and code disagree, the **Figma design** (`reports/figma-status-annotations.md`) decides.

**Target page:** `guides/procurement/creating-purchase-orders` (published title: *"Create and Send
Purchase Orders in Forethread"*) → **Order states** section. Cross-page diagram reconciliation
(quickstart, order-flows) is tracked separately in **FOR-231**.

**Ground truth**
- `packages/shared-types/src/enums/index.ts` → `PoStatus` (18 values) and `ApprovalStatus` (4 values).
- Design status model: `reports/figma-status-annotations.md` (PO section).

### Design ↔ code reconciliation (the one real ambiguity)

The Figma primary lifecycle does **not** list approval states inline and documents a **separate
Approval Status** field. The code `PoStatus` enum, however, still contains `PENDING_APPROVAL` and
`APPROVED` inline (alongside the separate `ApprovalStatus` enum). **Per the design-as-fallback rule the
design wins:** docs present approval as a separate field. The inline `PENDING_APPROVAL`/`APPROVED`
duplication in `PoStatus` is flagged to **FOR-231** for reconciliation (it is a code/data nuance, not a
user-facing badge state).

---

## Change 1 — replace the "Order states" table

**Current (wrong — invented shipping steps + inline approval):**

| State | What it means |
|---|---|
| Draft | Order created in Forethread but not yet sent to the vendor |
| Requested | An internal material request is pending approval before becoming a formal order |
| Approved | Approved internally and ready to be sent to the vendor |
| Ordered | Purchase order has been emailed to the vendor |
| Confirmed | Vendor has acknowledged receipt and confirmed the order |
| Partially Shipped | At least one delivery has shipped, but not all |
| Shipped | All deliveries have shipped from the vendor |
| Delivered | All materials have been received at the delivery location |
| Cancelled | Order was cancelled and is no longer active |

**Replace with — primary lifecycle (`PoStatus`):**

> A purchase order's status moves through the following lifecycle. **Draft** and any pre-issue approval
> states are visible only to your team (the contractor); from **Acknowledged** onward the status is a
> **shared document status visible to both you and the vendor**.
>
> | Status | What it means |
> |---|---|
> | Draft | Order created in Forethread but not yet sent to the vendor. Contractor-only. |
> | Sent | The order has been emailed to the vendor and is awaiting their response. |
> | Acknowledged | The vendor has received and acknowledged the order. *(Shared status — visible to both sides from here on.)* |
> | Accepted | The vendor has accepted the order and committed to fulfilling it. |
> | Declined | The vendor has declined the order. |
> | Change pending | A change/revision to the order is awaiting the other party's response. |
> | Cancelled | The order was cancelled by your team and is no longer active. |
> | Cancelled by vendor | The vendor cancelled the order. |
> | Closed | The order is complete and has been closed out. |
> | Invoiced | A vendor invoice has been received and matched against the order. |
> | Dispute | The order is under dispute (e.g. an invoice/delivery discrepancy). |
>
> *Vendor-triggered shared statuses are Accepted, Declined, Change pending, and Cancelled by vendor.*

**Add — optional delivery scope (only when delivery tracking is enabled on the order):**

> | Delivery status | What it means |
> |---|---|
> | Scheduled for delivery | A delivery date is set and the shipment is scheduled. |
> | Partially delivered | Some — but not all — line items or deliveries have been received. |
> | Delivered | All materials have been received at the delivery location. |
> | Late for delivery | The scheduled delivery date has passed without receipt. |
> | Not delivered | The delivery did not arrive / was not fulfilled. |

**Add — separate Approval Status field (`ApprovalStatus`, NOT part of the status badge):**

> When your company requires internal approval before an order is sent, the order also carries an
> **Approval Status**, tracked independently of the lifecycle above:
>
> | Approval Status | What it means |
> |---|---|
> | Not required | No internal approval is needed for this order. |
> | Pending | The order is awaiting internal approval before it can be sent. |
> | Approved | The order has been approved internally and is ready to send. |
> | Rejected | The order was rejected during internal approval. |

---

## Change 2 — inline status reference in "Step 5: Send to vendor"

**Current:** "Once sent, the order status changes from Draft to **Ordered**."
**Replace with:** "Once sent, the order status changes from Draft to **Sent**."

## Change 3 — "shipped" language elsewhere on the page (AC: replace shipping vocab)

- "Split across multiple deliveries": "…see which phases have **shipped** or been received." →
  "…see which phases have been **scheduled, delivered, or received**."

---

## Out of scope (here)

- No app/code changes (AC). Earlier buyer-UI relabel was git-reverted (02d8f94).
- Cross-page lifecycle diagrams (quickstart "Procurement flow", setup/order-flows "Common stage types")
  → **FOR-231** (reconcile) / **FOR-236** (Order Flows). They currently repeat the Ordered/Confirmed/
  Shipped vocabulary and must align to this same `PoStatus` model.
- The `PoStatus` inline `PENDING_APPROVAL`/`APPROVED` vs separate `ApprovalStatus` duplication →
  flagged to **FOR-231**.
- Nav naming ("Orders" / "+ New Order") — no AC in this ticket; leave unless FOR-231 says otherwise.

## Acceptance criteria coverage

- [x] PO docs present the `PoStatus` primary + optional-delivery lifecycle — Change 1
- [x] Approval documented as a separate Approval Status field, not inline statuses — Change 1
- [x] "Shipped / Partially Shipped" replaced with delivery vocabulary — Change 1 + 3
- [x] Acknowledged-onward documented as a shared buyer+vendor status — Change 1 (intro + Acknowledged row)
- [x] No app/code changes
