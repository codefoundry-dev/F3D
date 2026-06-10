# FOR-231 — Cross-page PO & invoice lifecycle reconciliation (prepared change)

**Date:** 2026-06-10
**Status:** PREPARED — not applied (editable Mintlify source not on this machine; see
`reports/for-232-rfq-docs-change.md`). **Docs only — no app/code changes.** This is the cross-page
consistency pass; it uses the SAME canonical labels as FOR-230 (PO) and the invoice model below.

## Canonical models (design = code)

- **PO** — primary `PoStatus`: Draft → Sent → Acknowledged → Accepted / Declined / Change pending /
  Cancelled / Cancelled by vendor / Closed / Invoiced / Dispute. Optional delivery scope: Scheduled for
  delivery / Partially delivered / Delivered / Late for delivery / Not delivered. **Separate**
  `ApprovalStatus` (Not required / Pending / Approved / Rejected). Acknowledged onward = shared.
- **Invoice** — `InvoiceStatus`: **Pending, Approved, Disputed, Paid, Rejected** (NOT Unreviewed / Posted).

The single recurring error: pages express the PO path as **Draft → Ordered → Confirmed → Delivered**
with approval (Requested/Approved) shown *inline*, and "shipping" language. Approval is a separate
field; there is no Ordered/Confirmed/Shipped.

---

## PO lifecycle — every place to fix

| Page / location | Current (contradictory) | Reconcile to |
|---|---|---|
| `creating-purchase-orders` → Order states | (the big table) | FOR-230 model (already prepped — the canonical source) |
| `quickstart` → glossary "Purchase Order" | "states: Draft → Ordered → Confirmed → Delivered" | "Draft → Sent → Acknowledged → Accepted → (Delivered)" |
| `quickstart` → "order lifecycle" **mermaid flowchart** | Draft…Delivered nodes (Ordered/Confirmed/Shipped) | re-label nodes to `PoStatus`; show Approval Status as a side note, not a lifecycle node |
| `quickstart` → "Create your first order" prose | "status will show as **Requested or Approved**"; "send … to view and **confirm**" | approval = separate **Approval Status** (Pending→Approved); on send status = **Sent**; vendor **acknowledges** (Acknowledged) |
| `quickstart` cards | "Manage order states from Draft through Delivered" | fine, but ensure intermediate states match |
| `introduction` → workflows / concepts | "Track each order from Draft **through Confirmed** to Delivered"; "POs move through states from Draft to Delivered" | "Draft → Sent → Acknowledged → … → Delivered" |
| `order-flows` → default path | "Draft → **Ordered** → Delivered" | "Draft → Sent → Acknowledged → … → Delivered" |
| `order-flows` → custom example | "Draft → Pending Approval → Approved → **Ordered** → Delivered" | approval is the **Approval Status** field (Pending→Approved) gating **Send**; PO status path stays Draft → Sent → … |
| `order-flows` → "Common stage types" table | Draft/Pending Approval/Approved/Ordered/Confirmed/Delivered/Rejected | reconcile PO vocab; **coordinate with FOR-236** (the builder itself is roadmap-labelled) |

## Invoice flow — every place to fix

| Page / location | Current | Reconcile to |
|---|---|---|
| `processing-invoices` → "approval states" table | Unreviewed / Approved / Rejected / **Posted** (4 states) | **Pending / Approved / Disputed / Paid / Rejected** (`InvoiceStatus`). Unreviewed→**Pending**; add **Disputed** + **Paid**; **Posted** is ERP-posting (unbuilt) → not a status |
| `processing-invoices` → "state changes to Posted" / "ERP posting queue" | "Approved → Posted" | post-approval terminal is **Paid**; ERP "Post"/"Posted" → **coordinate with FOR-239** (coming-soon banner) |
| `processing-invoices` → filters | Unreviewed / Approved / Rejected / Posted | Pending / Approved / Disputed / Paid / Rejected |
| `processing-invoices` → flowchart (Receive→…→Post to ERP) | ends at "Post to ERP" | keep as target but mark ERP node coming-soon (FOR-239); ensure status nodes use `InvoiceStatus` |
| `quickstart` → "Process invoices" prose | "mark the invoice **Approved**" | consistent (Approved is real); no state contradiction beyond Inbox/AI being unbuilt (FOR-233) |

---

## Coordination (so pages don't fight)

- **Labels owned by:** FOR-230 (PO primary page), FOR-232 (RFQ), FOR-234 (Bulk Order). FOR-231 only
  propagates those same labels to the *other* pages and fixes the invoice vocab.
- **Coming-soon banners** (FOR-233 invoices, FOR-236 order-flows builder, FOR-239 ERP/deliveries) are
  layered on top — FOR-231 fixes the *vocabulary*, those tickets mark the *unbuilt features*. Apply both;
  they don't conflict.

## Acceptance criteria coverage

- [x] One canonical PO lifecycle across quickstart, order-flows, creating-purchase-orders
- [x] One canonical invoice flow across processing-invoices, order-flows
- [x] Contradictory variants removed (Requested/Approved prose, divergent flowcharts, Shipped language)
- [x] Approval documented as a separate field, not inline PO statuses
- [x] No page contradicts another on PO or invoice states
- [x] No app/code changes
