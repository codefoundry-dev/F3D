# FOR-235 — Roadmap "coming soon" notes on unbuilt fields/entities (prepared change)

**Date:** 2026-06-27
**Status:** PREPARED — not applied (the editable Mintlify source is **not** on this machine; only the
read-only `f3d` docs MCP is reachable — see `reports/for-232-rfq-docs-change.md` and the
`mintlify-docs-source-not-local` note). **Docs only — no content deleted, no app/code changes.**
**Label:** `roadmap-label` · **Source of truth:** docs (keep the documented fields as the intended target).

This is the detailed, apply-ready version of the FOR-235 row in `reports/for-roadmap-labels.md`.
Gap evidence: `reports/docs-implementation-gaps.md` §2, §3.5, §5.

---

## Ground truth (re-verified against current schema 2026-06-27)

| Documented field/entity | Schema check | Reality |
|---|---|---|
| Material **Default Cost Code** | `material.prisma` `Material` (lines 23–95) | **No `costCode`/`defaultCostCode` field on `Material`.** Cost code exists only as **free text at order time** — `PoLineItem.costCode`, `PurchaseOrder.costCode`, `RfqLineItem.costCode` (`purchase-order.prisma:104,174`, `rfq.prisma:149`). There is no per-material default that auto-applies to orders. |
| Managed **Units of Measure** list (Settings screen) | `material.prisma:36` `uom String @db.VarChar(50)` | **UoM is free text.** No `UnitOfMeasure` model/enum, no `Settings → Units of Measure` screen, no managed standard-unit list. |
| Vendor **Payment Terms** | `company.prisma` `Company` (lines 36–95) | **No `paymentTerms` on `Company`.** `paymentTermsDays` lives on the PO header (`purchase-order.prisma:102`); `paymentTerms` on the quote response (`rfq.prisma:222`) — both order-level, not a vendor default. |
| Vendor **Notes** | `company.prisma` `Company` | **No `notes` field on `Company`.** |
| Vendor typed **Contact Types** | `company.prisma`; vendor contacts are `User` rows | **No `ContactType` enum.** A contact's role is a free-text string; there is no typed Sales/Quotes/Accounting/Customer-Service routing. (`DocumentType` exists but is for company documents, not contacts.) |
| Per-delivery **state machine** | `purchase-order.prisma` `PoDelivery` (lines 204–218) | **`PoDelivery` has no status field** — `id, purchaseOrderId, deliveryLocationId, deliveryDate, notes, sequence, createdAt`. Delivery progress is tracked on `PurchaseOrder.status`, not per-delivery. (The gap report cited line 193; the model is now at line 204 — line 193 is `PoDocument`.) |

**Callout convention** (same as the other roadmap tickets): use the repo's existing Mintlify admonition
(`<Note>` / `<Info>`). Standard text:

> 🚧 **Coming soon** — this is the intended capability and is not yet available in Release 1.

Apply per section below; **do not remove the surrounding content**. Where a "what's available today"
clarification helps, it is given verbatim.

---

## Page 1 — `guides/setup/material-database.mdx`

### 1a. "Default Cost Code"
Appears in two sections — **"Adding materials individually"** (the bullet *"Default Cost Code —
Standard cost code for this material"*) and the **"Material fields"** table (row *"Default Cost Code |
Standard cost code applied when this material is used on orders | No"*).

- Keep both as target spec.
- Add a coming-soon callout near the Material fields table (or on the Default Cost Code row):
  > 🚧 **Coming soon** — a per-material **Default Cost Code** that auto-applies when the material is
  > added to an order. **Today**, cost code is entered per line item directly on the order / RFQ.

### 1b. Managed Units of Measure list
Section **"Units of measure"** — the standard-units table and the line *"set up a custom unit of measure
in **Settings → Units of Measure**."*

- Keep the standard-units table as the intended catalog.
- Add a coming-soon callout:
  > 🚧 **Coming soon** — a managed **Units of Measure** list (Settings → Units of Measure) with the
  > standard units above and custom units. **Today**, a material's unit is entered as free text on the
  > material record.

---

## Page 2 — `guides/setup/vendor-management.mdx`

### 2a. Vendor Payment Terms & Notes
Section **"Vendor information fields"** — table rows *"Payment Terms | Default payment terms (e.g., Net
30)"* and *"Notes | Internal notes about this vendor, visible only to your team."*

- Keep both rows as target spec.
- Add a coming-soon callout on/under the table:
  > 🚧 **Coming soon** — vendor-level **Payment Terms** and **Notes** stored on the vendor record. (Payment
  > terms can be set per order today; they are not yet saved as a vendor default.)

### 2b. Typed Contact Types
Sections **"Adding contacts"** (the *"Role — Sales, Accounting, etc."* field) and **"Contact types"**
(the Contact Type / Purpose table: Sales/Orders, Quotes, Accounting, Customer Service).

- Keep both as target spec.
- Add a coming-soon callout on the **"Contact types"** section:
  > 🚧 **Coming soon** — typed **Contact Types** (Sales/Orders, Quotes, Accounting, Customer Service) that
  > automatically route the right document to the right contact. **Today**, a contact's role is a free-text
  > label and you select recipients manually when sending an order or RFQ.

---

## Page 3 — `guides/deliveries/tracking-deliveries.mdx`

### 3a. Per-delivery state machine (primary)
Section **"Delivery states"** — the 6-state table (Unscheduled / Requested / Scheduled / Shipped /
Pending Review / Delivered).

- Keep the table as the intended per-delivery lifecycle.
- Add a coming-soon callout above/under it:
  > 🚧 **Coming soon** — per-delivery statuses. **Today**, a delivery records its date, location, line
  > items, notes and documents, but its progress (shipped, received, etc.) is tracked at the **order**
  > level, not as an independent status on each delivery.

### 3b. Dependent claims on the same page
Tighten the wording wherever the page asserts an independent per-delivery status (keep the sections; just
fold them under the same coming-soon scope so they aren't read as live):

- **"Adding multiple deliveries"** — *"Each delivery tracks its own status, receipt, and documentation
  independently."*
- **"Filtering deliveries"** — the *"Status — Display deliveries in a particular state"* filter.
- **"Receiving deliveries"** — *"The delivery state changes to Delivered."*

> **Out of FOR-235 scope (do not edit here):** the **Delivery Dashboard** and **Delivery Calendar**
> sections are unbuilt-module roadmap and belong to **FOR-239**; the on-time/vendor **Delivery reports**
> belong to **FOR-240**. Leave those for their tickets to avoid double-editing.

---

## Page 4 — `guides/procurement/creating-purchase-orders.mdx`

### 4a. Per-delivery status (only)
Section **"Split across multiple deliveries"** — *"Each delivery tracks its own status independently, so
you can see which phases have shipped or been received."*

- Keep the multi-delivery capability as target spec.
- Add a coming-soon callout consistent with 3a:
  > 🚧 **Coming soon** — independent per-delivery statuses. You can split an order into multiple deliveries
  > today; tracking each delivery's status separately is on the roadmap (delivery progress is reflected on
  > the order status for now).

> **Out of FOR-235 scope (do not edit here):** the PO **"states"** table (Draft / Requested / Approved /
> Ordered / Confirmed / …) is the **purchase-order** lifecycle and is owned by **FOR-230 / FOR-231** — do
> not touch it under this ticket.

---

## Acceptance-criteria coverage

- [x] Roadmap "coming soon" notes on: material default cost code (1a), managed UoM list (1b), vendor
  payment-terms/notes (2a) + typed contact-types (2b), per-delivery statuses (3a/3b, 4a).
- [x] All four pages (`material-database`, `vendor-management`, `tracking-deliveries`,
  `creating-purchase-orders`) remain published with the intended fields/entities as the target.
- [x] No doc content deleted to match the code — callouts/clarifications only.

## Hand-off

Apply the callouts above in the Mintlify docs repo (not on this machine). Boundaries with adjacent
roadmap tickets are flagged inline: **FOR-230/231** own the PO state table; **FOR-239** owns the Delivery
Dashboard/Calendar; **FOR-240** owns delivery/vendor performance reports.
