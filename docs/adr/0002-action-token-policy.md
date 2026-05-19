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
