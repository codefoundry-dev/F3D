# ADR-0012: ERP integration — Xero in v1, bidirectional with per-entity authority, mapping wizard on enable

**Status:** Accepted — **Deferred to v2 per Release 1 scope amendment (2026-05-19)**
**Date:** 2026-05-12

## Context

US 9.03 specifies ERP integration with pull (vendors, cost codes, project codes, tax codes) and push (POs, deliveries, invoices, payment statuses). The one-line story conceals an enormous product surface — pick a different ERP and the integration is a rewrite; pick a different direction model and conflict resolution becomes its own product.

The platform is Australia-first (AUD default, ABN). The dominant accounting platform in that market is Xero. MYOB and QuickBooks have a meaningful tail but are clearly secondary.

A common failure mode in this category: ship three half-built ERP connectors, none of them certifiable or trustworthy, then spend the next year doing tier-3 support on integration bugs. We want to avoid that.

## Decision

**v1 ships one ERP: Xero.** No CSV import, no public REST API, no Zapier connector in v1. Adding MYOB and QuickBooks is post-v1 and explicitly out of scope for the first release.

**An internal `ErpAdapter` abstraction** sits between Forethread domain code and the specific ERP. v1 has one implementation. Future ERPs are added by writing additional adapters against the same interface.

**Bidirectional, scoped per entity:**
- **Pull (ERP is authoritative):** Vendor, Cost Code, Project Code, Tax Code.
- **Push (Forethread is authoritative):** Purchase Order (push at submission), Invoice (push on Finance approval as an approved bill), Payment status changes (received from ERP webhook, applied to invoice).

We deliberately do *not* try to round-trip the same entity in both directions. Each entity has one authoritative side; the other side mirrors. This eliminates the entire conflict-resolution class for ERP sync.

**Cadence.**
- Webhook-driven for entity changes Xero supports webhooks on.
- Hourly poll fallback for everything else and as a belt-and-braces consistency check.
- Manual trigger button on the integration admin page for ops debugging.

**Mapping wizard on enable.** When a Contractor first connects Xero, a wizard walks the Company Admin through mapping existing Forethread vendors against pulled Xero contacts. Choices:
- Map A → B (a Forethread vendor corresponds to a Xero contact).
- Leave A unmapped (Forethread-only — flagged "not in ERP", future syncs will create the contact on first push, or the admin can map manually).
- Leave B unmapped (Xero-only — the contact appears in Forethread's vendor list as a new entry).

The wizard never auto-deletes a Forethread vendor. Open RFQs, POs, action tokens, chat threads remain attached to the same Forethread vendor record regardless of mapping decisions — mapping changes *which Xero ID future syncs reference*, not the identity of the internal record.

**Chart-of-accounts mapping** (Forethread Project Code → Xero tracking category, etc.) is also part of the wizard, configured once per Contractor, then sync just works. Not user-editable per transaction.

## Consequences

- **The PRD says "Xero only in v1"** explicitly. No vague "ERP support."
- **The `ErpAdapter` interface is an architectural component the PRD names** even though only one implementation exists. This forces internal code to depend on the abstraction, not on Xero directly — making post-v1 adapters mechanical.
- **No generic API or CSV** means no early uncertified integrations. Customers asking for "just give us the data" before v2 will be turned down. This is a deliberate constraint on the v1 surface.
- **Push of POs and Invoices** requires careful mapping to the ERP's underlying concepts: Xero has Purchase Orders and Bills, but the semantics aren't exact matches. The integration spec must define each push verb concretely (e.g. Forethread `PO.submit` → Xero PO with status "submitted for approval"; Forethread `Invoice.approve` → Xero Bill "awaiting payment").
- **Payment status as the pull-back signal** is the loop-closer that solves the "missed Net-30, unpaid for a year" pain point: Finance gets due-date alerts (ADR-0011), pays the bill in Xero, webhook fires, Forethread updates the invoice as paid. No double-entry.
- **Mapping wizard means no silent destruction** of existing data on integration enable. Real customers have years of vendor history; auto-merge by email would corrupt audit trails on first sync.
- **Webhook reliability** is not 100% — the hourly poll catches missed webhooks. The PRD should not assume webhook-only.
- **Adapter authoritative pull conflict:** if a user edits a vendor's tax code in Forethread *and* in Xero, Xero wins on the next pull. The UI must warn that editing a pull-authoritative field in Forethread is overridden on next sync (and probably should be disabled in the UI for ERP-mapped records).

## Alternatives considered

- **Multiple ERPs in v1.** Rejected: half-built connectors are worse than no connector. Build one well.
- **CSV-only in v1.** Rejected: customers want push-back of payment status; CSV doesn't get there.
- **Public API + Zapier as the v1 strategy.** Rejected: requires API hardening and Zapier app certification, neither of which is faster than a single Xero adapter, and quality bar is harder to enforce when third parties build the integrations.
- **Pull-only.** Rejected: misses the platform's headline value-prop ("never miss a Net-30") which requires payment status to flow back.
- **Bidirectional same-entity sync with conflict resolution.** Rejected: tar pit. Per-direction authority is a clean line.
- **Auto-merge vendors by email on integration enable.** Rejected: case sensitivity, aliases, and historical duplicates make this silently destructive.

## Amendment — Release 1 scope (2026-05-19)

**ERP integration is deferred to v2.** No Xero adapter, no pull, no push, no payment-status webhook, no mapping wizard ships in Release 1.

### What changes in Release 1

- **Vendors, Cost Codes, Project Codes, Tax Codes** are entered manually in Forethread. No ERP pull.
- **POs and Invoices** stay in Forethread. No ERP push.
- **Payment status** is set manually by the Finance Officer (Invoice state transitions to `Paid` via a UI action, not via webhook). Audit log records the actor and timestamp; no double-entry guard against the matching Xero bill being unpaid.
- **The "never miss a Net-30" alert path is preserved.** Due-date approaching and overdue alerts (ADR-0011) fire on the Forethread invoice record alone — they do not require ERP confirmation.

### What stays in the design

- **The `ErpAdapter` interface is still named as an architectural placeholder** so that v2 adapter work plugs in without restructuring domain code. The interface is defined but has no implementation in Release 1.
- **Per-entity authority direction (pull-authoritative vs push-authoritative)** is captured in the data model so v2 can light up without schema changes.
- **The exclusion of multi-ERP, CSV-in/out, public API, and Zapier** is unchanged — those remain post-v1, and post-v1 here now means "after Xero ships."

### Consequences of the amendment

- Finance Officers operate Forethread and Xero as two separate systems in Release 1, with manual reconciliation between them at month-end. This is the explicit pre-platform workflow; we are not regressing it, only failing to improve it yet.
- The headline "never miss a Net-30" value-prop is delivered by Forethread alerts alone. The loop closes when a human marks the invoice Paid.
- v2 work begins with a clean adapter implementation against a well-specified interface; no migration of Release 1 hand-entered vendor/cost-code data is required (the manually-entered values become the seed for the first Xero pull, mapped via the wizard at v2 enable time).

The Xero-only single-ERP decision and the per-entity authority model both remain the post-v1 target.
