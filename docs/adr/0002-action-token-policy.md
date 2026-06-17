# ADR-0002: Action tokens — long-lived for read/draft, OTP-gated for commit actions

**Status:** Accepted
**Date:** 2026-05-12

## Context

[ADR-0001](0001-vendors-are-email-first.md) commits us to a tokenized-email path for every vendor-facing action. Tokens carry authority in lieu of a session, so the token policy is security-load-bearing. The trade-off is between vendor friction (forces a real login each time) and authority leakage (forwarded email = anyone can act as the vendor).

Vendor behaviour observed in the field: vendors regularly forward RFQ emails to colleagues who actually do the pricing; vendors reopen the same email days later to add detail; sales reps share inboxes. A single-use token UX would block all of these.

At the same time, some vendor actions move money or create commercial obligations: submitting a quote, acknowledging/declining/changing a PO, confirming or disputing a delivery, raising an invoice dispute. For these actions, "anyone with a forwarded link" is not an acceptable authorization story.

## Decision

Two tiers of authority:

1. **Action token** — long-lived (lifetime = lifetime of the underlying document), reusable, scoped to `(vendor, document, allowed-actions)`. Authorizes all **read** and **draft** actions: viewing the RFQ, saving partial responses, uploading attachments, viewing past PO history relevant to this document, viewing chat history.
2. **Commit-action OTP** — at the moment a vendor clicks "Submit", "Acknowledge", "Decline", "Confirm Delivery", "Raise Dispute", etc., the system emails a one-time code (~6 digits, 10-min expiry) to the vendor's registered email address. The action proceeds only after the OTP is entered. The OTP always goes to the *original vendor address on file*, never to a forwarded recipient.

The activated-vendor (logged-in) flow does not require OTP, because the session itself proves control of the address (verified at activation).

## Consequences

- A colleague who receives a forwarded RFQ email can draft the response but cannot submit without coordinating with the original vendor to retrieve the OTP. This is the intended behaviour — vendors who want to fully delegate can activate an account and invite the colleague as a user (Epic 3 multi-user invite).
- Email deliverability becomes critical: an OTP that never arrives blocks the entire transaction. Choice of transactional email provider must include strong deliverability + sub-30-second delivery SLA. Covered in a future ADR on email infra.
- Tokens must be revocable per-document (the Contractor can re-issue / invalidate, e.g. when a vendor's address changes).
- The OTP delivery address is the *vendor record's* email at the time of OTP request, not the address that originally received the action-token link. This handles forwarded-email cases correctly.
- A vendor who loses access to their email address effectively loses the ability to commit — recovery requires the Contractor (or Super Admin for cross-cutting cases) to update the vendor record. A vendor self-service recovery flow would defeat the whole authorization story, so we deliberately do not offer one.

## Alternatives considered

- **Plain long-lived token (no OTP).** Rejected: forwarded emails authorise commercial commitment by anyone in the chain.
- **Single-use magic-link session.** Rejected: breaks the vendor's ability to reopen the email later, breaks shared-inbox patterns, breaks delegation-by-forward.
- **OTP on every action, not just commit.** Rejected: turns every "view this RFQ" into a login flow, which is the exact UX the rebuild is supposed to escape.

## Amendment — Release 1 scope (2026-05-19)

The original two-tier model (long-lived action tokens for read/draft + commit-action OTP) is **narrowed for Release 1**:

- **No commit-action OTP in Release 1.** The action token alone authorises every vendor action — read, draft, and commit (quote submission, PO acknowledge/decline, delivery confirmation, dispute reply, change-request approval).
- **No rotation on vendor email change.** Tokens remain valid for the lifetime of the underlying document even if the vendor's email address on file is updated. The Contractor may explicitly revoke per-document.
- **Per-document revocation remains.** The Contractor can invalidate any individual token (e.g., when a vendor switches sales rep mid-RFQ and the Contractor wants to cut off the old contact).

### Consequences of the amendment

- **Authority leakage on forwarded emails is accepted as a Release 1 risk.** A vendor who forwards their RFQ link to a colleague gives that colleague full commit authority. The product team has judged the UX cost of OTP-gated commits (especially for the "vendor reopens the email 4 days later" pattern) higher than the leakage risk for Release 1.
- **The vendor-record-on-file as OTP destination is moot in Release 1** since there is no OTP. When OTP is reintroduced in v2, the original design (OTP to vendor-record email, not forward recipient) applies.
- **Token rotation can be reintroduced in v2** without breaking the token data model — rotation is a server-side rule, not a token-format change.
- **The token-validation middleware still resolves `current_contractor_id`** for RLS (ADR-0009). The amendment touches authority, not tenancy.

The full two-tier (token + commit-OTP) model remains the post-v1 target if abuse is observed in production.

## Amendment — Release 1 PO token policy (2026-06-16)

Extends the action-token model to the **Purchase Order** so an Unactivated Vendor can view a PO and Acknowledge / Accept / Decline it from an emailed link (closing the ADR-0001 gap where the PO email pointed at the authenticated route).

- **PO subject + single purpose.** Add `AccessTokenSubject.PURCHASE_ORDER` and one `PO_VIEW` purpose. The token is **PO-scoped**: its authority spans every vendor-facing PO action for the document's life (acknowledge/accept/decline now; delivery confirmation, change-request reply, dispute reply later), even though only the three response endpoints ship in R1.
- **Validated, never consumed.** Like the guest RFQ path, the PO token is validated but not `consume()`d, so it stays reusable across the vendor's interactions.
- **Fixed 30-day expiry — deliberate deviation.** Unlike the general rule above ("lifetime = lifetime of the underlying document"), a PO token expires **30 days after issue**. The 30-day window comfortably covers acknowledge/accept (which happen within days); it does *not* cover later lifecycle actions, which will **re-issue** a fresh token when those features are built.
- **Issued transactionally at `SENT`.** The token is created as part of the PO's DRAFT→SENT transition (both the direct-issue and approval→SENT paths), so a best-effort email failure cannot orphan the link.

### Consequences of the amendment

- **No re-send / recovery in R1 (accepted gap).** With a fixed 30-day cap and no re-send UI, a vendor who lets the link lapse — or never received the email — has no in-product recovery; resolution is out-of-band until re-send ships.
- **Revocation is backend-only in R1.** Per-document revocation (the base ADR) still holds as a capability, but no contractor-facing "revoke link" UI ships yet.
- **Guest actions are audited via the context table, not the global log.** Mirroring `QuoteAudit`, tokenless PO actions record an `actor {userId: null, label: <vendor legal name>}`; the global `AuditLog` remains real-users-only. The PO activity trail merges both sources.
- **Contractor notifications fire on Accept and Decline** (not Acknowledge), on the state transition itself, so both the authenticated and tokenised paths behave identically.
- Re-introducing a longer/sliding expiry or a re-send refresh later is a server-side rule change, not a token-format change.
