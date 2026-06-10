# Roadmap-label tickets — prepared changes (FOR-233 / 235 / 236 / 238 / 239 / 240)

**Date:** 2026-06-10
**Status:** PREPARED — not applied (editable Mintlify source not on this machine; see
`reports/for-232-rfq-docs-change.md`). **Docs only — no content deleted.**

These six share one pattern: under docs-as-target-spec, **keep** the documented feature as the intended
product and add a **"coming soon / not yet available in Release 1"** callout to the unbuilt sections;
where useful, add a short **"what's available today"** note. Built-vs-unbuilt facts come from each
ticket + `reports/docs-implementation-gaps.md` §5.

**Callout convention:** use the repo's existing Mintlify callout (e.g. `<Note>`, `<Warning>`, or an
`<Info>` admonition). Suggested standard text: **"🚧 Coming soon — this is the intended capability and
is not yet available in Release 1."** Apply per section below; do not remove the surrounding content.

---

## FOR-233 — Invoices (`guides/invoices/processing-invoices`)

Add coming-soon callouts to these sections (keep them as target spec):

- **Invoice Inbox** (inbound email address) — not built.
- **Manual upload** ("Upload Invoice") + **Step 2: AI-powered extraction** / **Reviewing extracted
  data** — not built (`UploadInvoicePage` is a stub).
- **Reconciliation → line-item matching** (matching invoice lines to PO materials/deliveries) — not
  built; only **header-level PO linkage** (`relatedPo`) exists today.
- **Post to ERP / Posted** — not built (also FOR-239).

**Add "Available today" note** at the top of the workflow: list / **approve** / **reject** invoices;
statuses `Pending / Approved / Disputed / Paid / Rejected`; header-level PO linkage. (Status vocabulary
itself is fixed in **FOR-231** — keep consistent.)

## FOR-235 — Unbuilt fields/entities

- `guides/setup/material-database` → **Default Cost Code** per material — coming soon.
- `guides/setup/material-database` (or wherever a Settings UoM list is described) → **managed Units of
  Measure list** — coming soon (UoM is free-text today).
- `guides/setup/vendor-management` → vendor **Payment Terms**, **Notes**, **typed Contact Types** —
  coming soon.
- `guides/deliveries/tracking-deliveries` + `guides/procurement/creating-purchase-orders` →
  **per-delivery state machine** (`PoDelivery` has no status field) — coming soon; today delivery status
  is tracked at the PO level, not per-delivery.

## FOR-236 — Order Flows builder (`guides/setup/order-flows`)

- Coming-soon callout on the **flow builder**: custom stages, routing conditions, approver assignment
  modes (Any-One / All-Required / Sequential), watchers, per-stage assignees.
- **Add "Available today" section:** single-step approval via the `po.approve` role permission with an
  optional per-role `thresholdAmount`; SUPER_ADMIN bypasses; below-threshold or ungranted →
  `PENDING_APPROVAL`; same model for invoices (`invoice.approve`). Only config surface: **Settings →
  Roles**. (Role names + the threshold model are fixed in **FOR-237**; PO/approval vocab in **FOR-231**.)

## FOR-238 — Inventory (`guides/inventory/managing-inventory`, `guides/inventory/inventory-requests`)

- `managing-inventory` → coming-soon banner; clarify a **"Warehouse" is currently only a saved
  location/address** (`WarehouseLocation` = name + address) with **no** stock-quantity tracking,
  transactions, transfers, or holds.
- `inventory-requests` → coming-soon banner (no request model or states implemented).
- Keep both pages published. (Designed-but-unbuilt: `us13-warehouse-ops` / `us14-field-requests` e2e are
  `test.fixme`.)

## FOR-239 — ERP posting & Deliveries dashboard

- `processing-invoices` → coming-soon banner on **Post to ERP** (QuickBooks, Sage, Foundation, Viewpoint
  Vista, CMIC, Procore — explicit "not yet implemented" placeholder, `dashboard.service.ts:709`).
  Coordinate with FOR-233 (same section) and FOR-231 (don't present "Posted" as a real status).
- `tracking-deliveries` → coming-soon banner on the **Delivery Dashboard** (Today / Upcoming / Past Due /
  Unscheduled) and **Delivery Calendar** (daily/weekly/monthly) — not implemented; deliveries are only
  edited inside the PO form today.

## FOR-240 — Price Sheets, Concrete Commitments, vendor performance

- `guides/setup/vendor-management` → coming-soon on **Price Sheets** (no price-sheet/per-vendor-price
  model, no PO price auto-fill engine) and on **Vendor Performance** metrics (no on-time rate /
  lead-time / issue tracking).
- `guides/commitments/concrete-commitments` → coming-soon banner (no concrete / pour / mix-design model
  exists). Note overlap with FOR-234's naming "Secondary" item — apply the banner regardless of the
  rename decision.

---

### AC coverage (all six)

Each ticket's ACs are: (a) coming-soon banner on the named unbuilt sections, (b) page stays published
with the full intended workflow as target, (c) where required, a "what's live today" clarification,
(d) **no doc content deleted**. The section lists above map 1:1 to those ACs.
