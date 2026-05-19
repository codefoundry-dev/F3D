# ADR-0010: Per-document chat threads with email-in reply

**Status:** Accepted
**Date:** 2026-05-12

## Context

US 3.03 mandates an in-app chat thread per document, with attachments, read-only on document closure, and reachable from a central inbox. [ADR-0001] requires every vendor-facing action to be possible from the inbox without an account.

Forcing the vendor to click a tokenized link every time they want to reply "yes, that delivery date works" violates the email-first principle. Even for vendors who *do* activate, real-world supplier teams live in their email client and reply from there.

Two non-trivial design pieces follow:
1. **Email-in must produce a real Message** indistinguishable in the UI from a web-posted one (modulo a small "received by email" badge on attachments). Otherwise the experience splits in two and the Contractor sees a confusing two-channel mess.
2. **Attachments from email** are the most common reason a vendor replies in the first place ("here's the spec sheet you asked for"). Dropping them is unacceptable.

## Decision

**Email-in via a per-thread reply address.** Each Thread gets `thread-<thread_id>+<reply_token>@reply.forethread.app` (or similar). The inbound mail pipeline:
1. Authenticates the sender against the reply token's `vendor_id` and `thread_id`. Mismatched sender → bounce with a generic deliverability error.
2. Parses the body, strips quoted reply chains (standard heuristics + DSN markers).
3. Scans attachments — size limit, AV scan, extension allowlist (PDF, PNG/JPG/HEIC, XLSX/XLS, DOCX, CSV; rejected types bounce with a clear reason in the bounce body).
4. Posts a Message to the Thread with `posted_via = "email"` and the attachments attached.

**Reply tokens are read/draft tier.** Posting a message is not a commit action — it does not commit to a price, accept a delivery, or move money. Therefore OTP is *not* required to post (per ADR-0002 the OTP is reserved for commit actions). The reply token itself is sufficient authority, and is scoped to one Thread.

**Both paths are first-class.** The web chat UI (reached via the tokenized link) and email-in produce indistinguishable Message records. The only UI distinction is a small "received by email" badge on attachments (for auditability), and the Vendor's display name comes from the Vendor record on both paths.

**Thread closure on parent terminal state.** RFQ awarded → RFQ chat read-only. PO completed/cancelled → PO chat read-only. Invoice paid/voided → invoice chat read-only. **Reopen is supported** by Contractor users only (vendors cannot reopen) and is audit-logged.

**Unified inbox.** Every user (including vendors) sees a single Inbox of all Threads they participate in, ordered by latest message, filterable by parent document type.

## Consequences

- **Inbound mail infra is load-bearing**. The platform needs a reliable inbound-email service (SES inbound + Lambda, Mailgun routes, Postmark inbound, or similar). DNS for `reply.forethread.app` MX must be operationally owned. A future ADR will pick the specific provider once the email-out provider is also chosen (likely the same vendor).
- **Reply tokens must rotate** when the underlying document moves between authority states (e.g., thread closes, vendor changes on the document). On rotation, old reply tokens bounce with a clear reason.
- **Vendor identity attribution from email** depends on the sender address. If a vendor replies from a different address than the one on file, the system rejects the reply with a deliverability-error bounce and a UI hint (visible to the Contractor on the next web visit) explaining how to update the vendor's email. We do *not* silently accept "looks-like-the-right-domain" addresses — that's an authority leak.
- **Attachments stored on email-in** carry the same retention and access policy as web-uploaded ones. The "received by email" badge is metadata, not a separate storage tier.
- **Quoted-chain stripping is imperfect** for all clients. We accept some leakage of quoted text into the Message body in v1; users can edit their own outbound messages but not their inbound (because they came from email). A future v2 may add a "clean up" button on inbound.
- **Reopen-on-closure** with audit means closed threads are not immutable forever; auditors looking at a closed PO must understand that subsequent thread messages may exist. The audit log distinguishes original-period messages from reopen-period messages.
- **Thread is not Vendor-scoped overall** — it's parent-document-scoped. If a Contractor and a Vendor have 50 active POs together, they have 50 separate Threads. The Inbox makes this navigable.

## Alternatives considered

- **No email-in; tokenized-link only for vendor replies.** Rejected: violates the email-first principle for the most common vendor action.
- **Email-in but no attachments.** Rejected: defeats the most common reason a vendor replies in the first place.
- **Vendor-scoped single thread per vendor, all docs share it.** Rejected: collapses unrelated document conversations into one stream; impossible to determine "is this comment about PO #123 or PO #145?"
- **Auto-close with no reopen.** Rejected: realistic close-then-resolve cases need a clean path; workarounds (raising a new dispute on a paid invoice) are worse.
- **Require OTP for chat replies.** Rejected: posting a message is not a commit action; OTP would crush the email-first UX with no security upside.
