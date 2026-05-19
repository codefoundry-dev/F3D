# ADR-0001: Vendors are email-first; accounts are optional

**Status:** Accepted
**Date:** 2026-05-12

## Context

The previous build of this product failed in market because it forced suppliers to create accounts before they could respond to RFQs. The competing product (Navatik) does not — suppliers stay in their inbox, click a tokenized link, fill a form, done. The meeting that kicked off this rebuild named this as the single most important design principle.

At the same time, the user stories describe a Vendor Dashboard, vendor-side chat, vendor profile management, vendor multi-user invites, and PO acknowledgement/delivery update flows on the vendor side. Read naively, those features imply Vendors must have accounts after all.

## Decision

A Vendor has two states: **Unactivated** (email-only contact record) and **Activated** (real account with dashboard/chat/profile). Activation is always optional. Every vendor-facing action in the system — RFQ response, PO acknowledgement, change-request approval, delivery confirmation, invoice dispute reply, in-app chat reply — MUST have a working tokenized-email path. The dashboard, chat UI, profile, and multi-user features are enhancements unlocked by activation; they are not on the critical path of any transaction.

## Consequences

- Every workflow must be designed with two equivalent entry points: an authenticated UI path and a tokenized-link path that produces the same result.
- Tokens must carry enough scope to identify the Vendor, the document (RFQ/PO/delivery/invoice), and the action — without a session.
- Token security (expiry, revocation, single-use vs replay, rotation on email forward) becomes a load-bearing concern. To be covered in a separate ADR once the token model is fixed.
- "Login as the vendor" debugging and impersonation flows need a Contractor-Admin-friendly story; you cannot rely on the vendor existing as a user.
- In-app chat threads must support an "email participant" who replies via email-to-thread, not just authenticated users.

## Alternatives considered

- **Lazy magic-link account.** First click creates a passwordless account. Rejected: still couples every action to "an account exists," and complicates the mental model when a vendor wants to forward an RFQ link to a colleague.
- **Two separate entities (`VendorContact` vs `VendorCompany`).** Rejected: doubles the modelling cost and forces Contractors to think about which kind of vendor they're adding. The state transition (unactivated → activated) is internal and should not be visible to Contractors.
