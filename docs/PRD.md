# Forethread — Product Requirements Document

**Status:** Draft for sign-off — **Release 1 scope amended 2026-05-19**
**Date:** 2026-05-12 (last amended 2026-05-19)
**Owner:** Forethread (Ayo)
**Sources:** `docs/user-requirement.md`, `docs/User Stories - JD.xlsx` (104 stories across 9 epics)
**Companion documents:** [CONTEXT.md](../CONTEXT.md) (glossary), [docs/adr/](adr/) (12 architectural decisions)

---

## 0. Release 1 Scope Decisions (locked 2026-05-19)

This block is the authoritative Release 1 scope. Where the body of this PRD or any ADR conflicts with this block, the block wins. Original text is retained for historical context.

### Direct PRD/spec contradictions resolved

| Topic | Release 1 decision | Note |
|---|---|---|
| Currency | **Per document** (not per Contractor as originally drafted). AUD is the default but a different currency can be chosen per RFQ / PO / Invoice / Bulk Order from a predefined list. | §5.6 + §7 amended in place. |
| Bulk Order source | **Created only from approved RFQ responses.** Standalone Bulk Order creation (vendor/items/ceiling/price/validity entered freehand) is deferred to v2. | §4.5.6 amended. |
| Approval engine | **Minimal: single-stage, single-role.** Quorum + multi-stage chains + 3-deep OOO delegation deferred to v2. | ADR-0006 amended. |
| RFQ creation sources | BOM, **Material Request(s)**, manual, copy, saved material list. File upload deferred. | §4.5.3 amended. |

### ADR amendments

| ADR | Release 1 amendment |
|---|---|
| [ADR-0002](adr/0002-action-token-policy.md) | **Token-only.** No commit-action OTP in v1. No rotation on vendor email change. Long-lived per-document tokens authorise all vendor actions. Per-document revocation preserved. |
| [ADR-0006](adr/0006-approval-workflow-engine.md) | Single-stage, single-role engine. Closed action list: **PO above threshold, Invoice above threshold, Major Change Order, Bulk Order amend**. OOO = delegate + escalate to Company Admin (no 3-deep chain). |
| [ADR-0008](adr/0008-field-pwa-offline-and-sync.md) | **Edit-until-sync** replaces 15-min on-device window. Append-only events, idempotency keys, tiered media, GPS-only retained. |
| [ADR-0012](adr/0012-erp-integration-scope.md) | **Xero deferred to v2.** No ERP pull/push/webhook in v1. Finance Officer marks invoices Paid manually. `ErpAdapter` interface remains as architectural placeholder. |

### Deferred to v2 (no v1 build)

- **ERP integration (Xero)** — all of it.
- **Inventory system (Epic 7)** — warehouses, On-hand/Reserved/In-transit/Damaged states, ATP, low-stock alerts, transfers, project-locked warehouses, bulk upload, usage reports, calendar.
- **Field Purchase Report (FPR)** — synthetic Ordered+Delivered+Invoiced for cash purchases.
- **Aggregated/bundled catalogue products** — single catalogue item composed of N child items at fixed ratios.
- **Public catalogue contribution flow** — Contractor propose → Super Admin approve (promotion-as-copy). Public catalogue remains read-only to Contractors in v1.
- **Vendor tagging** (free-form labels) and tag-based RFQ vendor selection ("all vendors with matching tag").
- **Handwritten list extraction** (Tier-B from handwriting).
- **Mobile read-only documents view** (Foreman browse mode for POs/MRs/deliveries).
- **Vendor picker filters** by rating, item-category, or activation state (rating is still captured per-PO; just not exposed as a picker filter).
- **Performance budgets** as CI gates (informal targets only).
- **Send-delivery-notes dedicated UI** — Foreman reuses the PO thread (ADR-0010).
- **Warehouse leg of Stock-and-Bulk Check** — v1 checks bulk orders only; warehouse inventory check lands with Epic 7.

### Included in v1 (additions to scope previously implicit or missing from the spec)

| Area | v1 scope |
|---|---|
| Document Extraction (ADR-0005) | Full tier model: **Tier B** (pre-filled form, source on click) and **Tier C** (mandatory side-by-side). Configurable confidence threshold (default 0.85). Extraction telemetry from day one. |
| Three-way match (ADR-0004) | Full: continuous re-run on every PO/delivery/invoice change, Contractor-configurable tolerance (default ±2%), asymmetric over-delivery (always requires Finance Officer approval), line-level acceptance. |
| Threads (ADR-0010) | Full: per-thread reply addresses, email-in with attachment handling, sender authentication, quoted-chain stripping, **Unified Inbox** across all threads, auto-close on terminal state, Contractor-only reopen (audit-logged). |
| Notifications (ADR-0011) | Full: 5-min email digest per `(recipient, parent_document)`, always-immediate types (overdue payment, overdue approval), per-event-per-channel preference matrix, role + project assignment subscriber resolution. |
| Vendor management | Rating per-PO (on-time / quality / accuracy → 1–5 aggregate, surfaces on vendor profile). ABN optional at vendor add but **mandatory before first RFQ selection**. Every vendor-facing email includes a "set a password" activation link (per ADR-0001). |
| Vendor activation perks | Activated vendors get **all four**: dashboard, chat UI / Unified Inbox, profile management, multi-user invites. |
| Invoice arrival | **Upload + email-in.** Dedicated address `inbound@invoice.forethread.app` (or per-Contractor sub-addressing). System extracts vendor + PO via OCR. Unidentified invoices land in a **Super Admin routing queue**. |
| Invoice state machine | Full 8-state machine: Received → Identified → Matched → Disputed → Approved → Awaiting Payment → Paid → Voided. Voided invoices retain audit trail and remain visible. **Paid is set manually** (no ERP webhook in v1). |
| RFQ lifecycle | RFQ becomes **read-only once any vendor has responded**. Edits require cancel + reissue. |
| BOM versioning | **Mutable until first RFQ; then immutable.** Subsequent edits create a new BOM revision. Existing RFQs/POs reference the version they were created against. |
| Out-of-Office | Date range + single delegate. If delegate is also OOO → escalate directly to Company Admin (no 3-deep chain in v1). |
| Approval thresholds | Company Admin sets PO and Invoice approval thresholds per Contractor. **No platform default** — every Contractor must set values during onboarding before a PO or Invoice can be created. |
| Action tokens | Long-lived per-document, reusable, scoped to `(vendor, document, allowed-actions)`. Per-document revocable by Contractor. **No rotation** on vendor email change. |
| Foreman dashboard (mobile) | Active MRs + pending delivery confirmations + sync queue (badge showing `N events not yet synced`). |
| Field PWA flows | Photo of printed list → MR (Tier-B extraction). In-app notepad with promote-to-MR. Upload invoice at delivery time (Tier-C extraction, creates Invoice record linked to the delivery + PO). |
| Multi-tenancy (ADR-0009) | **Super Admin BYPASSRLS sessions audited** with actor + rationale. Per-entity **History tab** on every business document. **Same vendor email under different Contractors = different records** (no global vendor pool) made explicit. |
| Bulk Order visibility | Vendors see **only child POs**, never the parent Bulk Order itself (ADR-0003 confirmed). |
| PO/Bulk parent link | Drawdown PO detail page surfaces a "From Bulk Order [BO-####]" card with remaining qty/spend (internal users only). |
| Currency in emails | Every price in every vendor-facing email shows the currency code explicitly (e.g. `AUD $1,250.00`). Subject lines include currency. |
| Cross-cutting NFRs | **WCAG 2.2 AA** on web. **7-year audit retention.** **Document extraction quality telemetry** from day one. (Formal performance budgets deferred.) |

---

## 1. Product overview

### 1.1 What we are building

A construction procurement platform for subcontractors. It takes the entire materials lifecycle — from a Foreman saying *"I need 20 bags of cement on site"* through quote, PO, delivery, invoice, three-way match, and payment — out of inboxes, Excel sheets, and WhatsApp, and into one system with structured workflows.

### 1.2 The killer insight

**Vendors do not have to log into anything.** A vendor stays in their email client. When a Contractor sends an RFQ, the vendor receives an email with a tokenized link, clicks it, fills the quote, and that's it. Every vendor-facing action — RFQ response, PO acknowledgement, change requests, delivery confirmation, invoice dispute reply, chat message — has a working email-first path. Vendors *may* activate an account for dashboard/chat/profile niceties, but activation is always optional. The previous build broke market because it forced vendors to create accounts.

See **[ADR-0001](adr/0001-vendors-are-email-first.md)** and **[ADR-0002](adr/0002-action-token-policy.md)** for the authority model.

### 1.3 The problem replaced

Today subcontractors do this manually:
1. Win a tender → email 5–10 suppliers asking for prices
2. Wait for replies scattered across inboxes
3. Copy-paste into Excel to compare
4. Issue a PO via email
5. Receive materials, receive invoices, lose track of which invoice matches which PO
6. Miss Net-30 deadlines → incur penalties, or invoices sit unpaid for a year

The platform replaces every step of this with structured workflows.

### 1.4 The seven roles

| Role | Scope | Primary surface |
|---|---|---|
| **Super Admin** | Platform operator (Forethread). Manages public catalogue, system health, unmatched invoices. Reads across Contractors. | Web admin |
| **Company Admin** | Runs a Contractor's account. Configures approvals, users, project assignments, integrations. | Web |
| **Procurement Officer** | RFQs, quote comparison, POs, bulk orders, change requests. | Web |
| **Finance Officer** | Invoice reconciliation, payment, disputes. | Web |
| **Foreman** | On-site, mobile-first. Raises material requests, confirms deliveries, field purchases. | **PWA (mobile)** |
| **Warehouse Officer** | Stock and material releases. Mobile-first. | **PWA (mobile)** |
| **Vendor** | Supplier. Email-first; optional account. | Email + tokenized web |

### 1.5 The nine epics

| # | Epic | Stories | Section |
|---|---|---|---|
| 1 | User Management | 11 | §4.1 |
| 2 | Dashboards | 11 (split rows in xlsx) | §4.2 |
| 3 | Vendor Management | 12 | §4.3 |
| 4 | Material Catalogue | 7 | §4.4 |
| 5 | AI BOM Parsing & Procurement | 24 | §4.5 |
| 6 | Field PWA | 18 | §4.6 |
| 7 | Inventory System | 15 | §4.7 |
| 8 | Invoice & Reconciliation | 11 | §4.8 |
| 9 | Other (notifications, audit, ERP, admin, currency) | 6 | §5 |

---

## 2. Architectural foundation

These are the load-bearing decisions. Every section below is consistent with them. Read the ADRs for full rationale.

| # | Decision | Summary |
|---|---|---|
| [ADR-0001](adr/0001-vendors-are-email-first.md) | Vendor model | Email-first; activation optional; every action has a tokenized-link path. |
| [ADR-0002](adr/0002-action-token-policy.md) | Tokens | Long-lived per-document tokens for read/draft; OTP gate on commit actions. |
| [ADR-0003](adr/0003-bulk-order-is-its-own-entity.md) | Bulk Order | Its own entity (price/qty agreement), not a PO variant. POs drawdown from it. |
| [ADR-0004](adr/0004-three-way-match-policy.md) | 3-way match | Continuous, Contractor-tunable tolerance, asymmetric on over-delivery. |
| [ADR-0005](adr/0005-document-extraction-contract.md) | Document extraction | One `DocumentExtraction` primitive; tiered review surfaces; closed catalogue authority. |
| [ADR-0006](adr/0006-approval-workflow-engine.md) | Approvals | Staged + quorum + auto OOO delegation; no mid-chain branching; closed action list. |
| [ADR-0007](adr/0007-stock-and-bulk-check.md) | Stock-and-bulk check | Fires on Officer open; blocking by default; one-click atomic execution. |
| [ADR-0008](adr/0008-field-pwa-offline-and-sync.md) | Field PWA | Append-only events; on-device 15-min edit; project-scoped offline cache; tiered media upload. |
| [ADR-0009](adr/0009-multi-tenancy-with-rls.md) | Tenancy | Shared Postgres with row-level security; fails closed on missing filter. |
| [ADR-0010](adr/0010-threads-with-email-in.md) | Threads | Per-document threads; vendors can reply via email-in; auto-close on terminal state. |
| [ADR-0011](adr/0011-notifications.md) | Notifications | Event bus; in-app real-time + email digest; OTP and overdue always immediate. |
| [ADR-0012](adr/0012-erp-integration-scope.md) | ERP | Xero only in v1; per-entity direction; mapping wizard on enable. |

---

## 3. Domain glossary

Authoritative glossary lives in **[CONTEXT.md](../CONTEXT.md)**. Terms used in this PRD with specific meanings:

Contractor, Vendor (Unactivated / Activated), Vendor list, Action token, Commit action, Purchase Order, Standard PO, Hold-for-release PO, Consolidated PO (and child POs), Bulk Order, Drawdown, Material Request, RFQ, Quote, Three-way match, Dispute, Document Extraction, Review surface tiers (B / C), Unmatched item, Approval workflow, Approvable action, Out-of-Office marker, Warehouse, Stock-and-Bulk Check, Transfer request, Field PWA, Delivery report, Tenancy model, Thread, Inbox, Notification, ErpAdapter, Currency, Audit event, Change request (Commercial / Internal), Field Purchase Report, Project assignment, Document state, Inventory state, Available-to-promise.

---

## 4. Functional scope

### 4.1 Epic 1 — User Management (11 stories)

#### Scope

- New user registration via tokenized invite (30-day expiry).
- Account activation via invite link → set password.
- Login: email + password + email OTP.
- Password reset.
- Role-based access control (RBAC).
- Per-Contractor approval workflow configuration.
- Inviting users, managing roles, project assignment.
- Contractor profile.
- User profile.
- User work-status display (active / OOO / inactive).

#### Acceptance criteria

- **Invitation flow.** Super Admin creates the first user of a Contractor (Company Admin role). Company Admin invites additional users with role + project assignment. Invitation tokens are valid 30 days. An expired token cannot be redeemed; a new invitation must be issued (audit logged).
- **Authentication.** Email + password + email OTP at every login. OTP is 6 digits, 10-min expiry, delivered via the same email provider as action-token OTPs. Failed-OTP rate limit: 5 attempts per 10 min per user.
- **RBAC × Project assignment.** Permissions are role-derived. Visibility is project-derived. A Procurement Officer assigned to Project Alpha cannot see Project Beta's data even if their role permits the action in principle. Company Admins see all projects in their Contractor by default.
- **Approval configuration UI** (Company Admin only) configures the closed list of Approvable actions ([ADR-0006](adr/0006-approval-workflow-engine.md)). For each action: entry condition (typically a threshold), ordered list of stages (role + quorum). No mid-chain branching.
- **Out-of-Office.** Each user can set OOO with date range and a single delegate. Auto-applies during the window. **In Release 1, if the delegate is also OOO the request escalates directly to the Company Admin (no 3-deep chain).** v2 raises chain depth to 3.
- **Profile.** First/last name, contact email, mobile, photo, role, OOO status, project assignments visible.
- **Work-status display.** Inactive (no login for N days, configurable), OOO, Active — surfaced on user-pickers and approval routing decisions.

#### Out of scope (deferred)

- SSO / SAML / OIDC federation.
- Custom RBAC roles (the 7 roles are fixed).
- Approval action additions beyond the closed list.

### 4.2 Epic 2 — Dashboards (11 stories)

#### Scope

One purpose-built landing dashboard per role:
- **Procurement** — active RFQs, awaiting approval, pending PO acknowledgements, due deliveries.
- **Super Admin** — platform health, unmatched invoices, public catalogue suggestions, integration status across Contractors.
- **Foreman** (mobile) — active material requests, pending delivery confirmations, low-signal pending sync queue.
- **Vendor** — open RFQs awaiting your response, POs awaiting acknowledgement, recent payments.
- **Warehouse Officer** — release requests assigned to your warehouse, incoming transfers, low-stock items.
- **RFQ dashboard / PO dashboard / Bulk Order view** — drill-downs by document type, filterable.
- **Material request and warehouse release dashboard** — combined operational queue.
- **Deliveries management** — all pending and recent deliveries.
- **Financial Dashboard** — invoices by state, due-date heatmap, overdue list, payment status, "uncategorised spend" from FPRs.

#### Acceptance criteria

- Every dashboard pulls from the same event-driven backend as Notifications ([ADR-0011](adr/0011-notifications.md)); state updates are real-time (no manual refresh).
- All dashboards respect Project assignment.
- Empty states explicitly explain what causes the empty state and the next action.
- Loading skeletons, not spinners, on first paint.
- Every numerical card links to the underlying filtered list.

### 4.3 Epic 3 — Vendor Management (12 stories)

#### Scope

- Vendor invitation (email-only, no account required to start transacting).
- In-app communication (per-document Threads, [ADR-0010](adr/0010-threads-with-email-in.md)).
- Vendor list management — Contractor-private (per [ADR-0001](adr/0001-vendors-are-email-first.md), per [ADR-0009](adr/0009-multi-tenancy-with-rls.md)).
- RFQ response with uploaded file (Tier-C side-by-side review, [ADR-0005](adr/0005-document-extraction-contract.md)).
- RFQ response via form.
- Vendor profile management (Activated only).
- PO receiving (email-first or web).
- Delivery updates from vendor side (e.g. ship-confirmation).
- Inviting additional users into a Vendor Company (Activated only).
- ~~Tagging vendors (free-form labels).~~ **Deferred to v2** — see §0.
- Display a sales-rep contact per vendor.
- Vendor rating (per-PO, **captured at delivery confirmation, surfaces on vendor profile; not exposed as a vendor-picker filter in v1**).

#### Acceptance criteria

- **Adding a Vendor** requires email + business name minimally. ABN is captured but optional at add-time, becomes required when the vendor is selected for any RFQ.
- **Activation is optional and lazy** — a vendor can transact via email forever. If they choose to activate (clicking a "set a password" link in any vendor email), they get the dashboard, profile management, multi-user invites, and chat UI.
- **Same email across Contractors = different records.** No global vendor pool.
- **Vendor profile fields** (Activated): business name, ABN, address, primary contact, additional users, sales rep, payment terms, certifications/licences, tax code.
- **Rating** is line-by-line at delivery confirmation: on-time, quality, accuracy. Aggregated to a 1–5 score visible in the vendor picker.
- ~~**Tagging** is per-Contractor; tags do not cross Contractor boundaries.~~ **Deferred to v2.**
- ~~**Vendor list filters**: by tag, by rating, by item-category previously supplied, by activation state.~~ **Deferred to v2** — the vendor picker in Release 1 supports search + saved-list + individual-pick only.
- **In-app chat threads** auto-open whenever a Contractor user starts a document with a vendor; vendor receives the first message via email with a reply-in address ([ADR-0010](adr/0010-threads-with-email-in.md)).
- **Activation entry point.** Every vendor-facing email (RFQ, PO, dispute, thread reply, payment notice) includes a "set a password to get a dashboard" link. Activation is always one click away — per [ADR-0001](adr/0001-vendors-are-email-first.md).
- **ABN.** Optional at vendor add. **Mandatory before the vendor can be selected for any RFQ.**
- **Activation unlocks all four perks in v1:** dashboard, chat UI / Unified Inbox, profile management, multi-user invites.
- **Same vendor email under different Contractors = different records.** No global vendor pool (per [ADR-0009](adr/0009-multi-tenancy-with-rls.md)).

### 4.4 Epic 4 — Material Catalogue (7 stories)

#### Scope

- **Public catalogue** — Super Admin managed, platform-wide.
- **Private catalogue** — per-Contractor.
- ~~Contribute to public catalogue (Contractor proposes → Super Admin approves; promoted as a *copy*).~~ **Deferred to v2.** Public catalogue is read-only to Contractors in Release 1.
- Lists and favourites (Contractor-scoped).
- Smart search across catalogue (search by name, code, item attributes, with fuzzy matching).
- ~~Aggregated/bundled products (one catalogue item composed of N child items at fixed ratios).~~ **Deferred to v2.**
- Per-item price history (min / max / average / last; computed across all received Quotes for that catalogue item under the Contractor).
- ~~Inventory state of the item visible in search results.~~ **Deferred to v2 with Epic 7.**

#### Acceptance criteria

- **Catalogue item fields**: catalogue ID, name, description, unit of measure, tax code, item-category, manufacturer (optional), SKU (optional), default tags.
- **Smart search** ranks by exact-then-fuzzy, then by item-category match, then by recency in this Contractor's procurement.
- ~~**Aggregated product** acts as one line in RFQs/POs but decomposes into child items at delivery confirmation and during three-way match.~~ **Deferred to v2.**
- **Price history per item** scoped to the Contractor; the Public catalogue's price-history view shows ranges aggregated across all Contractors but is anonymised (Super Admin only sees per-Contractor detail).
- **Adding to private catalogue** from a file upload uses the Document Extraction layer (Tier-B review, [ADR-0005](adr/0005-document-extraction-contract.md)).
- **Vendors cannot write to any catalogue.** They can only pick from a Contractor's catalogue at quote time. Unmatched items at quote time block submission and surface to the Contractor for catalogue resolution.

### 4.5 Epic 5 — AI BOM Parsing & Procurement (24 stories)

The trunk of the platform. Aligned to [ADR-0004](adr/0004-three-way-match-policy.md), [ADR-0005](adr/0005-document-extraction-contract.md), [ADR-0006](adr/0006-approval-workflow-engine.md), [ADR-0007](adr/0007-stock-and-bulk-check.md).

#### 4.5.1 Project

- Create a Project with: name, location, storage location(s) (link to Warehouses), status, budget, currency (inherited from Contractor).
- View all Projects assigned to me.
- Only assigned users see Project data ([ADR-0009](adr/0009-multi-tenancy-with-rls.md) at the application layer + Project assignment filter).

#### 4.5.2 BOM

- Upload BOM as PDF / XLS / CSV. Document Extraction (Tier B) parses line items; user resolves unmatched items per [ADR-0005](adr/0005-document-extraction-contract.md). Saved BOM is the source of truth for procurement on that Project.
- Edit BOM — pre-submission only. Submitted BOMs are immutable; new versions are saved as separate BOM revisions.

#### 4.5.3 RFQ flow

- **Create RFQ** from: BOM, Material Request(s), approved RFQ copy, manual entry, or saved material list. (~~File upload~~ deferred to v2 — Release 1.) Many MRs → one RFQ (cardinality table in CONTEXT.md). A single MR is never split across multiple RFQs.
- **Add / edit RFQ draft** until submission.
- **Vendor selection**: pick individually or from saved vendor lists. (~~"All vendors with matching tag"~~ deferred to v2 with vendor tagging.)
- **Send RFQ** generates per-vendor action tokens ([ADR-0002](adr/0002-action-token-policy.md)) and dispatches an email per vendor with a tokenized link and the RFQ document attached. **Release 1: the action token alone authorises submission — no commit-OTP** (ADR-0002 amendment).
- **Vendor responds** via form or PDF upload (Tier-C side-by-side review on PDFs). Vendor must round-trip every line to a catalogue ID before submitting.
- **RFQ becomes read-only** once any vendor has responded. Edits after this point require cancel + reissue. The cancel flow notifies all invited vendors and invalidates their tokens.
- **Pick-up RFQ items** flag at RFQ-line level — Contractor will collect from vendor.

#### 4.5.4 Quote review

- **Two interchangeable views**: Comparison table (vendors as columns, lines as rows, lowest price highlighted per line); List view (one entry per vendor with totals).
- **Line-item approval across vendors** — award 600m of copper wire to Vendor A and 400m to Vendor B from the same RFQ line. Generates per-vendor child POs ([ADR-0003 cardinalities](../CONTEXT.md)).
- If Contractor's approval workflow requires it, the award routes through the approval engine ([ADR-0006](adr/0006-approval-workflow-engine.md)) before becoming POs.

#### 4.5.5 PO creation

- POs can be created from: approved RFQ award, Bulk Order drawdown, Material Request promotion, manual entry, copy-existing PO.
- One PO is always (Vendor, Project, delivery location). For multi-Vendor / multi-Project / multi-Location, use **Consolidated PO** → auto-generates child POs on submit. Vendors only ever see their child PO.
- PO variants: **Standard** and **Hold-for-release** (with `not_before` date). Bulk is *not* a PO variant — see Bulk Orders.
- **Pick-up PO** flag: Contractor collects instead of vendor delivering. Disables delivery scheduling fields.
- **PO submission** is a commit action — final and immutable except via change-request flow.

#### 4.5.6 Bulk Orders

- **Create Bulk Order** ([ADR-0003](adr/0003-bulk-order-is-its-own-entity.md)) — **Release 1: created only from an approved RFQ response.** Vendor, item(s), ceiling quantity, agreed unit price, validity window, optional project restriction all inherit from the approved RFQ. Standalone Bulk Order creation deferred to v2.
- **Drawdown** — Procurement Officer creates a PO referencing a Bulk Order; inherits price and Vendor; Bulk Order's remaining quantity/spend decrements.
- **Amend Bulk Order** — price change, ceiling bump. Does NOT retroactively change historical drawdown POs. Routes through approval ([ADR-0006](adr/0006-approval-workflow-engine.md)).
- **Vendor visibility:** vendors see only **child drawdown POs**. The parent Bulk Order is never visible to the vendor.
- **PO/Bulk parent surface:** a drawdown PO's detail page shows a "From Bulk Order [BO-####]" card with remaining qty/spend on the parent (internal users only).
- **Bulk Order view** (dashboard) — list of active Bulk Orders with remaining, projected exhaustion date, attached child POs.

#### 4.5.7 Change requests

- **Commercial change** (price, qty, delivery date): requires bilateral approval. May also route through internal approval engine if it crosses the threshold.
- **Internal change** (cost codes, project codes, accounting tags): immediate apply by authorised role, counterparty notified.
- Counter-proposals on the same change-request thread.

#### 4.5.8 Approval scenarios

- Documented per [ADR-0006](adr/0006-approval-workflow-engine.md). **Release 1: minimal engine — single-stage, single-role.** Closed approvable-action list for v1: **PO above threshold, Invoice above threshold, Major Change Order, Bulk Order amend.** Company Admin sets PO and Invoice thresholds per Contractor (no platform default — must be set during onboarding). Sign-off requires acceptance criteria for: single-stage approval routing, OOO delegate + escalate-to-Company-Admin, rejection-rolls-back-to-draft.

#### 4.5.9 Convert Material Request → RFQ

- Officer opens an MR. Stock-and-Bulk Check runs ([ADR-0007](adr/0007-stock-and-bulk-check.md)). **Release 1: bulk leg only** — the check covers active Bulk Orders only. The warehouse-inventory leg lands with Epic 7 in v2. Officer reviews the proposed plan (bulk drawdowns + residual RFQ). One-click atomic execution.

#### 4.5.10 Other procurement stories

- **Warehouse release request** (create / change / accept) — routes through approval, decrements Reserved → triggers Warehouse Officer pick action.
- **PO & RFQ locations split** — handled by Consolidated PO's auto-split rules.
- **PO & Bulk** combined view — surface on PO detail showing parent Bulk Order context if drawn down.
- **Pick-up POs / Pick-up RFQ items** — line-level flag.

### 4.6 Epic 6 — Field PWA (18 stories)

Aligned to [ADR-0008](adr/0008-field-pwa-offline-and-sync.md). **Release 1 scope narrowed per §0.**

#### Scope (Release 1)

- **Foreman dashboard (mobile)** — active MRs, pending delivery confirmations, sync queue badge (`N events not yet synced`).
- **Material Request**: manual catalogue selection; **photo of printed list** (Tier-B extraction); **free-text in-app notepad** with **notepad-to-MR promotion**. (~~Handwritten list extraction~~ deferred to v2.)
- ~~Mobile documentation view (read-only POs/deliveries/MRs)~~ **deferred to v2.**
- **Submit delivery report** (append-only event, [ADR-0008](adr/0008-field-pwa-offline-and-sync.md)) — per-line delivered/partial/not-delivered/rejected, mandatory photo, auto-GPS, optional invoice photo.
- **Vendor rating capture at delivery confirmation** — Foreman rates on-time / quality / accuracy per line; aggregated 1–5 surfaces on vendor profile.
- **Flag damaged items** — separate photo, returned-vs-accepted disposition.
- **Upload invoice** at delivery time — kicks off the invoice flow without requiring email later (Tier-C extraction, creates Invoice record linked to the delivery + PO).
- **Send delivery notes** — Foreman reuses the PO Thread ([ADR-0010](adr/0010-threads-with-email-in.md)) to post a confirmation/comment message to Procurement. No dedicated delivery-note UI.
- **GPS auto-capture.**
- **Edit-until-sync** (ADR-0008 amendment): event editable on-device until first successful sync; then immutable on every device.
- ~~Inventory updates from deliveries~~ **deferred to v2 with Epic 7.** Deliveries are captured as events on the PO; they do not propagate to warehouse state in v1.
- ~~Confirm internal material transfer~~ **deferred to v2 with Epic 7.**
- ~~Accept warehouse release request~~ / ~~Release items~~ **deferred to v2 with Epic 7.**
- **In-app notifications** — push to PWA, respect Notification preferences ([ADR-0011](adr/0011-notifications.md)).
- ~~Field Purchase Report~~ **deferred to v2.**

#### Acceptance criteria

- Works offline for all field actions (project-scoped cache).
- Photos compressed → thumbnail uploads immediately; full-res background uploads on Wi-Fi.
- All field events carry client idempotency key; server dedupes.
- **Edit-until-sync**: event mutable on-device until server ack; after that, immutable on every device.
- Foreman is never shown stock data on mobile (per [ADR-0007](adr/0007-stock-and-bulk-check.md)) — moot in v1 since the warehouse leg is deferred.
- Push notifications require explicit OS-level permission grant; falls back to in-app polling if denied.

### 4.7 Epic 7 — Inventory System (15 stories) — **DEFERRED TO v2**

The entire Inventory epic ships in v2. None of the items in this section are in Release 1 scope. The section text below is retained for v2 reference. See §0 for Release 1 consequences (the warehouse leg of Stock-and-Bulk Check is also deferred; deliveries do not propagate to warehouse state).

Aligned to **Inventory state** model in [CONTEXT.md](../CONTEXT.md).

#### Scope (v2)

- **Inventory tracking** — per Warehouse, per item.
- **Manage warehouses** — create, name, location, `is_shared` flag, `home_project_id` for project-locked warehouses.
- **Inventory states** — On-hand / Reserved / In-transit / Damaged.
- **Location-based dashboard** — view stock at one Warehouse.
- **Company-level dashboard** — aggregated stock across all Warehouses for the Contractor.
- **Bulk upload inventory** (CSV/XLS) — Document Extraction Tier B; unmatched items can be added to private catalogue inline (per [ADR-0005](adr/0005-document-extraction-contract.md), Contractor users may create private catalogue items).
- **Add to catalogue during bulk inventory update** — same flow inline.
- **Track material usage** — material drawn down on accepted deliveries, releases, transfers; reports of usage per Project.
- **Automatic inventory updates** from delivery reports, releases, transfers (no manual edits to On-hand; corrections go through an admin tool that audit-logs).
- **Configure low-stock thresholds** — per item, per Warehouse.
- **Low-stock alerts** — fires when On-hand drops below threshold ([ADR-0011](adr/0011-notifications.md)).
- **Warehouse calendar** — chronological view of inventory movements at a Warehouse.
- **Create manual warehouse release** (not driven by an MR) — same Approvable-action path.
- **Inventory reports** — usage by Project, usage by item, slow-movers, low-stock, damaged.
- **Add inventory items to a request** — Officer can include direct-from-stock items on an RFQ if they want vendor pricing for comparison (advisory only, doesn't reserve stock).

#### Acceptance criteria

- Inventory edits are *never* free-form. All changes derive from events (delivery, release, transfer, FPR, manual-release).
- Available-to-promise (On-hand − Reserved) is the figure shown on Stock-and-Bulk Check.
- Project-locked warehouses block cross-project draws unless a Transfer request is approved.

### 4.8 Epic 8 — Invoice & Reconciliation (11 stories)

Aligned to [ADR-0004](adr/0004-three-way-match-policy.md), [ADR-0005](adr/0005-document-extraction-contract.md).

#### Scope

- **Upload invoice** — from dashboard, PO page, or attach to a delivery report. Tier-C side-by-side extraction review.
- **Submit invoices via dedicated email** — `inbound@invoice.forethread.app` (or per-Contractor sub-addressing). System extracts contractor / vendor / PO via OCR; creates Invoice record.
- **Manual invoice identification** — Super Admin reviews unidentified emailed invoices in a routing queue and routes them to the right Contractor (or rejects).
- **Matching invoice with PO** — automatic on creation; Finance Officer confirms.
- **Reconcile the invoice** — three-way match per [ADR-0004](adr/0004-three-way-match-policy.md). Continuous. Line-level approve/reject. Over-delivery requires explicit approval.
- **Resolve invoice disputes** — threaded with bilateral approval of proposed changes.
- **Manage invoice states** — Received → Identified → Matched → Disputed → Approved → Awaiting Payment → Paid → Voided.
- **Invoice history** — per-vendor, per-PO views.
- **Payment notifications** — due-date approaching, overdue (always-immediate, [ADR-0011](adr/0011-notifications.md)).
- **One invoice → multiple POs** linkage at line level.
- **Financial reports** — invoices by state, AP aging, by vendor, by project, by cost code.

#### Acceptance criteria

- Email-in supports PDF, image attachments, multi-attachment per email.
- Invoice line items resolve to catalogue IDs via Document Extraction before three-way match runs.
- Three-way match runs on every change to PO / delivery aggregate / invoice; dashboards always show the current view.
- **Payment status is set manually by the Finance Officer in Release 1** (Awaiting Payment → Paid is a UI action; ERP webhook is deferred per [ADR-0012](adr/0012-erp-integration-scope.md) amendment). The "Mark as Paid" action is audit-logged with actor and timestamp. v2 reintroduces ERP webhook → automatic Paid transition.
- Voided invoices retain audit trail and remain visible in history.
- Unidentified email-in invoices land in a Super Admin routing queue; the SA picks the target Contractor + linked PO or rejects with a reply email.

---

## 5. Cross-cutting features (Epic 9 — Other)

### 5.1 Notifications

[ADR-0011](adr/0011-notifications.md). Event-bus-driven. In-app real-time + email digest. Per-user matrix, default-loud on approvals/money/exceptions. OTPs, overdue payments, overdue approvals bypass digest.

### 5.2 Audit trail

Append-only `audit_event` table on every consequential transition (see CONTEXT.md). 7-year retention. Read-only to all users including Super Admin. Per-entity "History" tab on every document page. Super Admin RLS-bypass sessions are themselves audited.

### 5.3 Admin panel (Super Admin)

- Contractor management — create, suspend, view usage.
- Public catalogue management — approve/reject contributions, edit items.
- Unmatched invoice routing.
- Platform health metrics — sync queue depth, OCR job failures, email deliverability.
- Cross-Contractor reports (anonymised price benchmarks across Contractors).

### 5.4 ERP integrations — **DEFERRED TO v2**

[ADR-0012](adr/0012-erp-integration-scope.md). ~~Xero only in v1.~~ **All ERP integration deferred to v2** per the §0 scope amendment. In Release 1 vendors, cost codes, project codes, and tax codes are entered manually in Forethread. POs and invoices stay in Forethread. Finance Officer marks invoices Paid manually. The `ErpAdapter` interface is defined as an architectural placeholder for v2 work.

### 5.5 Entity states management

Each document type has a clearly enumerated state machine. Submitted = immutable, changes via change-request flow. Drafts are freely editable. No "5-minute regret window" on non-field documents. Field events: 15-min on-device window only.

### 5.6 Currency

**Per-document currency, AUD default.** A different currency can be chosen per RFQ / PO / Invoice / Bulk Order from a predefined list. Every vendor-facing email shows the currency code explicitly on every price (e.g. `AUD $1,250.00`, `USD $980.00`); subject lines include the currency code where price is referenced. (Originally drafted as one-currency-per-Contractor in v1; amended 2026-05-19 per §0.)

---

## 6. Non-functional requirements

### 6.1 Authentication & security

- All commit actions require either an active authenticated session OR a valid action token ([ADR-0002](adr/0002-action-token-policy.md)). **Release 1: no commit-action OTP** — the action token alone authorises vendor commits. User-login OTP (for activated users) remains.
- Tokens scoped to (vendor, document, allowed-actions). Revocable per-document. **No rotation on vendor email change in Release 1.**
- TLS everywhere.
- Postgres RLS enforced at the database layer ([ADR-0009](adr/0009-multi-tenancy-with-rls.md)). CI check fails the build if a new Contractor-scoped table lacks a policy.
- OTP delivery within 30 seconds (SLA on the email provider) — applies to user-login OTP.
- Failed-OTP rate limits — applies to user-login OTP.
- **Super Admin RLS-bypass sessions** logged with actor + rationale; append-only audit row per session.

### 6.2 Reliability & data integrity

- Atomic execution of Stock-and-Bulk plans ([ADR-0007](adr/0007-stock-and-bulk-check.md)).
- Idempotent field-event submission ([ADR-0008](adr/0008-field-pwa-offline-and-sync.md)).
- Append-only audit events; no destructive corrections.
- Webhook + hourly poll for ERP consistency.
- Backups: daily full + WAL streaming; tested restore drill quarterly. (Specific RPO/RTO targets deferred to Open Decisions.)

### 6.3 Performance targets — **informal in v1**

**Formal CI performance budgets are deferred to v2.** The targets below remain useful design guidance but are not enforced as gates in Release 1.

- Web dashboard time-to-interactive: < 2s on broadband (informal).
- Mobile field-action submission (queued): < 200ms perceived (offline-first; informal).
- Three-way match recomputation: < 5s for a PO with up to 100 lines and 20 deliveries (informal — likely needs measurement once Epic 7 deliveries land in v2).
- Email-in to Invoice record visible in UI: < 60s end-to-end (informal).
- Notification fanout (event → in-app): < 1s p95 (informal).
- Page-load p95: < 3s (informal).

### 6.4 Document extraction quality

- Confidence threshold default 0.85, Contractor-configurable.
- Telemetry on precision, recall, manual-correction rate per document type — from day one.

### 6.5 Offline-first mobile

- Project-scoped cache, refresh on connect.
- All field actions submittable offline.
- 15-min on-device edit window then immutable.
- Photos: thumbnail upload immediate, full-res background.

### 6.6 Accessibility

- WCAG 2.2 AA on web. Keyboard-navigable; screen-reader labels on all controls; colour-not-only state indication.
- Mobile PWA: tap targets ≥ 44pt; high-contrast mode; large-text mode.

### 6.7 Compliance & retention

- 7-year audit retention (AU record-keeping).
- ABN, GST handled via Tax Codes pulled from Xero.
- Privacy: only Contractor users see their Contractor's data; Vendors see only documents they participate in; Super Admin access is audited.

### 6.8 Internationalisation

- AUD-only display formatting in v1.
- All vendor-facing emails include currency code unambiguously.
- UI in English-AU only. Other locales post-v1.

---

## 7. Out of scope for v1

Named explicitly so they don't reappear as "we promised X." Anything not listed and not in the PRD is also out of scope by default.

- **All ERP integration** — Xero (and everything else) deferred to v2 per §0. MYOB, QuickBooks, SAP, etc. are still post-v1 when Xero ships.
- **Multi-currency per Contractor** — ~~one currency per Contractor, locked at creation.~~ **Amended:** per-document currency selection is in v1; AUD is the default.
- **Mid-chain conditional branching in approval workflows** — configure separate workflows on separate conditions. (Moot in Release 1 — minimal engine is single-stage.)
- **Quorum + multi-stage chains in approval workflows** — deferred to v2 per ADR-0006 amendment.
- **3-deep OOO delegation chains** — deferred to v2 (Release 1: 1 delegate + Company Admin fallback).
- **Inventory system (Epic 7)** — deferred to v2.
- **Field Purchase Report (FPR)** — deferred to v2.
- **Aggregated/bundled catalogue products** — deferred to v2.
- **Public catalogue contribution flow** — deferred to v2.
- **Vendor tagging** and tag-based vendor selection — deferred to v2.
- **Handwritten list extraction** — deferred to v2.
- **Mobile read-only documents view** (Foreman browse mode) — deferred to v2.
- **Vendor picker filters** (rating, item-category, activation state) — deferred to v2.
- **Send-delivery-notes dedicated UI** — Foreman uses the PO Thread.
- **Commit-action OTP for vendors** — deferred per ADR-0002 amendment.
- **Action-token rotation on vendor email change** — deferred per ADR-0002 amendment.
- **15-minute on-device edit window for field events** — replaced by edit-until-sync per ADR-0008 amendment.
- **Generic public API / Zapier / CSV-in-CSV-out** — no integration surface other than Xero.
- **SSO / SAML / OIDC.**
- **Custom RBAC roles** — the 7 roles are fixed.
- **Open approvable-action set** — adding a new approvable action requires a code change.
- **Global vendor pool** — vendors stay per-Contractor.
- **Per-vendor or per-category match tolerances** — Contractor-wide tolerance only.
- **Closing-event three-way match** — match is continuous.
- **Collaborative live-edit of field events** — append-only event model; no shared editing.
- **Vendor recovery flows on lost email access** — recovery requires Contractor intervention.
- **Per-document follow/unfollow notification subscriptions** — subscription is by role + project assignment.
- **Per-request approver picking** — role-based only.
- **Vendor-authored catalogue items.**
- **Real-time exact-match three-way match (no tolerance).**
- **Time-based approval auto-escalation** (beyond OOO).

---

## 8. Open decisions (sign-off required before build)

These are deliberately deferred from the PRD-grilling phase. Each needs an answer before / during build but does not gate PRD sign-off.

| # | Decision | Notes |
|---|---|---|
| 8.1 | **Email provider** — for transactional (OTP, RFQ invites, digests) and inbound (Thread replies, invoice email-in). | Likely one vendor for both: SES, Postmark, or Mailgun. Pick to optimise deliverability SLA. |
| 8.2 | **OCR / multimodal LLM provider** for Document Extraction. | Claude / GPT / Gemini / Textract+LLM. Side-by-side benchmark on real BOMs / quotes / invoices before pick. |
| 8.3 | **PWA framework / offline DB.** | Next.js PWA with IndexedDB via a library (Dexie, RxDB) is the obvious path; confirm at start of build. |
| 8.4 | **Real-time transport for in-app push.** | SSE vs WebSocket; pick at build time based on hosting choice. |
| 8.5 | **Hosting & DB platform.** | Vercel + a managed Postgres (Supabase / Neon / RDS) is one obvious shape; not bound by the PRD. |
| 8.6 | **Auth library / strategy.** | Custom session with email + password + OTP is enough; framework choice (Auth.js, custom) to be picked at build. |
| 8.7 | **Backup RPO/RTO targets.** | Set with hosting choice. |
| 8.8 | **Specific approval thresholds & default workflows out of the box.** | Captured in onboarding configuration; not PRD content. |
| 8.9 | **Xero adapter mapping specifics** (PO → Xero PO vs Bill, etc.). | Detail spec at start of integration build. |

---

## 9. Acceptance for sign-off

This PRD is ready for sign-off when:

- The 12 ADRs are read and any disagreement is raised and resolved (one ADR amendment per disagreement).
- Section 7 ("Out of scope for v1") is reviewed line-by-line and explicitly accepted.
- The Open Decisions in §8 are acknowledged as build-time decisions, not blockers.

The PRD is a living document for the duration of build — material change to any decision in §2 or §7 requires updating the corresponding ADR (or adding a new one) and re-circulating.
