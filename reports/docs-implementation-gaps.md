# Forethread — Documentation vs. Implementation Gap Analysis

**Date:** 2026-06-09
**Docs source:** Mintlify knowledge base (`f3d.mintlify.app`, 14 pages) via MCP
**Code source:** this monorepo — `apps/backend` (NestJS), `apps/web` (React), `packages/*`
**Method:** Read the documented spec for every page, then verified each claim against the Prisma schema, backend modules, and frontend features (direct reads + targeted source sweeps).

---

## 1. Executive summary

The published docs describe the **intended full product**. The codebase implements a **Release-1 subset**. Three patterns recur:

1. **Whole modules are documented but not built** — Inventory/Warehouse stock, Inventory Requests, Price Sheets, Concrete Commitments, configurable Order Flows, a standalone Vendor Portal, a Deliveries dashboard, and ERP posting.
2. **Built features use different names and state machines** than the docs — most importantly "Commitments" ship as **Bulk Orders/Drawdowns**, and PO/RFQ/Invoice status labels differ on almost every value (`Ordered`→`SENT`, `Confirmed`→`ACKNOWLEDGED/ACCEPTED`, `Posted`→`PAID`, `Unreviewed`→`PENDING`).
3. **The docs are internally inconsistent** — the PO lifecycle alone appears in at least four contradictory forms across pages (§6).

Several "missing" modules have **`test.fixme` e2e specs** in `tests/e2e/procurement/`, so they are *designed but not yet implemented* — the docs run ahead of the current release rather than describing a different product.

Legend: ✅ matches · ⚠️ exists but diverges · ❌ not implemented

---

## 2. Module-level status

| Documented feature | Status | Implementation reality |
|---|---|---|
| Purchase Orders | ⚠️ | Exists; 18 statuses vs the 9 documented |
| RFQ / Quotes | ⚠️ | Exists; every state label differs |
| Invoices | ❌⚠️ | List / approve / reject only — **no create, upload, extraction-to-invoice, or line-item reconciliation**. `UploadInvoicePage` is a stub. |
| Material Catalogue | ✅⚠️ | Exists; **no "default cost code"**, UoM is free text (not a managed list) |
| Vendors | ⚠️ | Vendor = `Company`; **no contact-types, no payment-terms/notes fields** |
| Material Commitments | ⚠️ | Shipped as **"Bulk Orders / Drawdowns"** — different name + states |
| Concrete Commitments / Pours / Mix Designs | ❌ | No model, service, or UI anywhere |
| Inventory / Warehouse **stock** | ❌ | `WarehouseLocation` is name + address only — **no stock, quantities, transactions** |
| Inventory Requests | ❌ | No model, workflow, or states |
| Price Sheets / vendor pricing auto-fill | ❌ | No price-sheet model, no per-vendor price record, no auto-fill engine |
| Order Flows (approval builder) | ❌ | No flow builder; approval is a flat single-step role+threshold check |
| Deliveries (dashboard / calendar) | ❌ | Deliveries are statusless sub-rows on a PO; no standalone page |
| Vendor Portal (standalone app) | ⚠️ | No separate app; vendors use the same `apps/web` via guest tokens or a VENDOR login |
| ERP posting (QuickBooks/Sage/…) | ❌ | Explicit `// placeholder (not yet implemented)` |
| Vendor performance metrics | ❌ | None |

---

## 3. State-machine corrections (source of truth)

### 3.1 Purchase Order — `apps/backend/src/prisma/schema/purchase-order.prisma:1`

Docs (canonical table in `creating-purchase-orders`): `Draft, Requested, Approved, Ordered, Confirmed, Partially Shipped, Shipped, Delivered, Cancelled` (9).

**Actual `PoStatus` (18):**
```
DRAFT, PENDING_APPROVAL, APPROVED, SENT, ACKNOWLEDGED, ACCEPTED, DECLINED,
SCHEDULED_FOR_DELIVERY, CANCELLED, CLOSED, PARTIALLY_DELIVERED, DELIVERED,
LATE_FOR_DELIVERY, CANCELLED_BY_VENDOR, INVOICED, DISPUTE, NOT_DELIVERED, CHANGE_PENDING
```

| Docs label | Actual enum | Note |
|---|---|---|
| Draft | `DRAFT` | ✅ |
| Requested | `PENDING_APPROVAL` | approval-gated send |
| Approved | `APPROVED` | ✅ (name) |
| **Ordered** | **`SENT`** | Controller: *"Issue a draft purchase order (DRAFT → SENT)"*. There is no `ORDERED`. |
| **Confirmed** | **`ACKNOWLEDGED` → `ACCEPTED`** | Vendor flow is **two steps**, not one "Confirmed" |
| Partially Shipped / Shipped | — | No "shipped" concept; see `SCHEDULED_FOR_DELIVERY`, `PARTIALLY_DELIVERED`, `LATE_FOR_DELIVERY`, `NOT_DELIVERED` |
| Delivered | `DELIVERED` | ✅ |
| Cancelled | `CANCELLED` (+ `CANCELLED_BY_VENDOR`) | ✅ |
| *(undocumented)* | `DECLINED, CLOSED, INVOICED, DISPUTE, CHANGE_PENDING` | exist in code, absent from docs |

**Send/approval behavior** (`apps/backend/src/modules/purchase-orders/po-status.service.ts`):
- `SUPER_ADMIN` bypasses approval → `DRAFT → SENT`.
- Otherwise `ApprovalAuthorizationService.evaluate(role, 'po.approve', total)`:
  - `allowed` → `DRAFT → SENT`, `approvalStatus` stays `NOT_REQUIRED`
  - `belowThreshold` / `notGranted` → `DRAFT → PENDING_APPROVAL`, `approvalStatus = PENDING`

### 3.2 RFQ — `apps/backend/src/prisma/schema/rfq.prisma:8`

Docs: `Unreviewed, Quote Requested, Quote Received, Ordered, Cancelled`.

**Actual `RfqStatus`:** `DRAFT, OPEN, AWAITING_RESPONSE, QUOTED, AWARDED, CLOSED, CANCELLED`.

| Docs label | Actual enum |
|---|---|
| Unreviewed | `DRAFT` |
| Quote Requested | `AWAITING_RESPONSE` (sent) / `OPEN` |
| Quote Received | `QUOTED` |
| Ordered | `AWARDED` |
| Cancelled | `CANCELLED` (+ `CLOSED`) |

> Note: the vendor-portal page says submitting a quote sets status **"Quote Received"**; code sets **`QUOTED`**.

### 3.3 Invoice — `apps/backend/src/prisma/schema/invoice.prisma:1`

Docs (`processing-invoices`) claim *"every invoice is in one of **four states**: Unreviewed / Approved / Rejected / Posted."*

**Actual `InvoiceStatus` (five):** `PENDING, APPROVED, DISPUTED, PAID, REJECTED`.

| Docs label | Actual enum | Note |
|---|---|---|
| Unreviewed | `PENDING` | |
| Approved | `APPROVED` | only `PENDING → APPROVED` is wired |
| Rejected | `REJECTED` | `PENDING \| DISPUTED → REJECTED` |
| **Posted** | **`PAID`** | no "Posted" state; no ERP post action |
| *(undocumented)* | `DISPUTED` | in enum, but **no endpoint transitions into it** |

**Bigger gap:** the `Invoice` model has **no `invoiceNumber`, no `invoiceDate`, and no invoice-line-item model**. The documented "match each invoice line item to a PO line item, flag price/qty discrepancies" reconciliation has no backing data — linkage is header-level only (`relatedPoId`). There is also **no `POST /invoices`** endpoint, **no Invoice Inbox / inbound email**, and `apps/web/.../invoices/buyer/pages/UploadInvoicePage.tsx` is a *"under development"* stub.

### 3.4 Commitment → **Bulk Order** — `apps/backend/src/prisma/schema/bulk-order.prisma:1`

Docs (`material-commitments`): `Drafted, Confirmed, Partially Delivered, Delivered, Cancelled`.

**Actual `BulkOrderStatus`:** `ACTIVE, EXPIRED, COMPLETED, CANCELLED`. The word "commitment" does not appear in the schema; the feature is **Bulk Order** with **Drawdowns** (POs draw down `qty`/`ordered`/`qtyRemaining` on `BulkOrderLineItem`).

### 3.5 Delivery — `apps/backend/src/prisma/schema/purchase-order.prisma:193` (`PoDelivery`)

Docs describe a 6-state per-delivery machine: `Unscheduled, Requested, Scheduled, Shipped, Pending Review, Delivered`.

**Actual:** `PoDelivery` has **no status field** (`id, purchaseOrderId, deliveryLocationId, deliveryDate, notes, sequence`). All delivery progress is tracked on `PurchaseOrder.status`. There is no `receive delivery` endpoint and no `request delivery update` email.

---

## 4. Terminology map (docs → product/code)

| Docs term | Actual term in product/code |
|---|---|
| Commitment / Material Commitment | **Bulk Order** (+ Drawdown) |
| Order "Ordered" | **SENT** |
| Order "Confirmed" | **ACKNOWLEDGED** then **ACCEPTED** |
| Invoice "Unreviewed" | **PENDING** |
| Invoice "Posted" (to ERP) | **PAID** (no ERP) |
| RFQ "Quote Received" | **QUOTED** |
| RFQ "Ordered" | **AWARDED** |
| "Order Flow" / approval stages | **Role permission + `thresholdAmount`** (single-step) |
| "Warehouse" (with stock) | **WarehouseLocation** (an address; no stock) |
| Material "Inactive/Deactivated" | **ARCHIVED** (status also has `PUBLIC`, `PENDING_APPROVAL`) |
| Roles: Field User / PM / Director / Admin | `FOREMAN` / *(none)* / *(none)* / `COMPANY_ADMIN`, `SUPER_ADMIN` |

---

## 5. Absent or partial features — evidence

- **Inventory / stock** ❌ — `WarehouseLocation` (`company.prisma:113`) stores `name, city, postcode, address` only. No stock/quantity/transaction model. `dashboard.service.ts` "warehouse" widget only queries POs by delivery status. Spec exists but `tests/e2e/procurement/us13-warehouse-ops.spec.ts` is all `test.fixme`.
- **Inventory Requests** ❌ — no model/states; `us14-field-requests.spec.ts` is `test.fixme`. (`MATERIAL_REQUEST` exists only as a `PoSourceOfCreation`.)
- **Price Sheets** ❌ — no `priceSheet`/`vendorPrice` symbols anywhere; no PO price auto-fill. (`DocExtractionType.CATALOGUE` is catalogue import, not a price sheet.)
- **Concrete / Pours / Mix Designs** ❌ — "concrete" appears only as test fixture strings.
- **ERP** ❌ — `dashboard.service.ts:709` `// ERP Integration — placeholder (not yet implemented)`; `AdminPanelPage.tsx:16` "Detailed view coming soon." No QuickBooks/Sage/Foundation/Viewpoint/CMIC/Procore/GL logic.
- **Order Flows builder** ❌ — no flow/stage/approver/watcher engine. Settings page exposes only **Users, Company Profile, Roles**. `permission.prisma:22` comment: *"Release 1 is single-step."*
- **Vendor performance metrics** ❌ — none.
- **Vendor contacts / contact types** ⚠️ — contacts are vendor `User` rows with free-text role (`rfqs.ts:67`); no `ContactType` enum, no vendor `paymentTerms`/`notes` field. (`paymentTermsDays` lives on the PO; `paymentTerms` on the quote response.)
- **Vendor Portal** ⚠️ — single `apps/web`. Public route `/invitation/:token` (`RFQ_VIEW`/`QUOTE_SUBMIT` tokens) + VENDOR-role login. Implemented: confirm/accept/decline PO, messaging, quote submit (form+PDF), manage vendor users. **Absent:** mark-as-shipped (carrier/tracking), vendor "Upcoming Deliveries" section. **Partial:** doc upload is permitted by the backend but the upload button is hidden in the vendor UI (`PurchaseOrderDetailPage.tsx` `hideUpload=true`).

---

## 6. The docs contradict themselves

These are doc-only bugs (independent of code) and should be fixed regardless of the release gap.

**PO lifecycle appears in ≥4 forms:**
1. `quickstart` (key concepts): `Draft → Ordered → Confirmed → Delivered`
2. `order-flows` (default flow): `Draft → Ordered → Delivered`
3. `order-flows` (custom example): `Draft → Pending Approval → Approved → Ordered → Delivered`
4. `order-flows` (common stages table): `Draft, Pending Approval, Approved, Ordered, Confirmed, Delivered, Rejected`
5. `creating-purchase-orders` (states table): `…Ordered, Confirmed, Partially Shipped, Shipped, Delivered, Cancelled`
6. `quickstart` prose: *"status will show as **Requested** or **Approved**"*

None of these match each other, and none matches the code.

**Invoice lifecycle appears in 3 forms:**
- `processing-invoices` "four states": `Unreviewed / Approved / Rejected / Posted`
- `processing-invoices` diagram: `Receive → AI Extraction → Reconciliation → Review → Approve/Reject → Post to ERP`
- `order-flows` invoice flow: `Received → Reconciliation → Review → Approved → Posted`

---

## 7. What genuinely matches

RFQ → quote (form **and** PDF/AI extraction) → compare → convert-to-PO; tokenized guest vendor quote links; vendor PO acknowledge/accept/decline; vendor↔buyer messaging; bulk-order drawdowns tracking ordered/remaining qty; multi-tenant Company/Project/User structure; AI document extraction (`DocExtraction`: `INVOICE/QUOTE/CATALOGUE/BOM`) with human review/confirm.

---

## 8. Recommended doc fixes (priority order)

1. **Rewrite the PO, RFQ, and Invoice state tables** to the real enums (§3) and remove the conflicting variants (§6).
2. **Rename "Commitments" → "Bulk Orders"** (or add a clear alias note) across `material-commitments` and navigation.
3. **Mark unbuilt modules as "Coming soon / Roadmap"**: Inventory, Inventory Requests, Price Sheets, Concrete Commitments, Order Flows builder, ERP posting, Deliveries dashboard, standalone Vendor Portal, vendor performance.
4. **Fix the Invoices guide** — remove line-item reconciliation, Invoice Inbox, and "Post to ERP/Posted" until those exist; describe the actual approve/reject flow.
5. **Correct field-level claims**: Material "default cost code", managed Units-of-Measure list, vendor "payment terms/notes/contact types", per-delivery statuses.
6. **Align the roles taxonomy** with the real `UserRole` enum.

---

## Appendix — verified enum ground truth

| Enum | File | Values |
|---|---|---|
| `PoStatus` | `purchase-order.prisma:1` | DRAFT, PENDING_APPROVAL, APPROVED, SENT, ACKNOWLEDGED, ACCEPTED, DECLINED, SCHEDULED_FOR_DELIVERY, CANCELLED, CLOSED, PARTIALLY_DELIVERED, DELIVERED, LATE_FOR_DELIVERY, CANCELLED_BY_VENDOR, INVOICED, DISPUTE, NOT_DELIVERED, CHANGE_PENDING |
| `ApprovalStatus` | `purchase-order.prisma:36` | NOT_REQUIRED, PENDING, APPROVED, REJECTED |
| `PoType` | `purchase-order.prisma:22` | STANDARD, BULK, HOLD_FOR_RELEASE, DRAWDOWN, SPLIT |
| `RfqStatus` | `rfq.prisma:8` | DRAFT, OPEN, AWAITING_RESPONSE, QUOTED, AWARDED, CLOSED, CANCELLED |
| `QuoteResponseStatus` | `rfq.prisma:1` | PENDING, SUBMITTED, APPROVED, DECLINED |
| `InvoiceStatus` | `invoice.prisma:1` | PENDING, APPROVED, DISPUTED, PAID, REJECTED |
| `BulkOrderStatus` | `bulk-order.prisma:1` | ACTIVE, EXPIRED, COMPLETED, CANCELLED |
| `MaterialStatus` | `material.prisma:1` | PUBLIC, PENDING_APPROVAL, ARCHIVED |
| `UserRole` | `user.prisma:1` | SUPER_ADMIN, COMPANY_ADMIN, PROCUREMENT_OFFICER, FINANCIAL_OFFICER, WAREHOUSE_OFFICER, FOREMAN, VENDOR |
| `DocExtractionType` | `doc-extraction.prisma:9` | BOM, QUOTE, INVOICE, GENERIC, CATALOGUE |
| `VendorCategory` | `company.prisma:11` | 15 trade categories (CONCRETE_MASONRY … GENERAL_RETAILER) |
