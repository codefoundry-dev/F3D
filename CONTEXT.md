# Procurement Platform — Domain Context

The shared language of the procurement platform. This file captures terms whose
meaning is load-bearing and easy to blur. It is grown lazily as decisions are
sharpened; it is not an exhaustive glossary.

## Language

### Vendor access

**Vendor**:
An organization that supplies materials, addressed on a document by `vendorId`.
Has two states (see [ADR-0001](docs/adr/0001-vendors-are-email-first.md)):
- **Unactivated** — an email-only contact record; acts entirely through tokenised links.
- **Activated** — a real account with a dashboard/login.
Activation is always optional; every vendor action must work without it.

**Tokenised Vendor Link**:
A reusable, revocable link (backed by an `AccessToken`) that lets an
**Unactivated Vendor** view and act on a single document without logging in. It
must produce the *same result* as the authenticated path (ADR-0001), and — for
Release 1 — the token alone authorises every action with no OTP
([ADR-0002](docs/adr/0002-action-token-policy.md)). Lifetime is per-document:
RFQ/quote tokens follow ADR-0002's "lifetime of the document"; **PO links are
capped at a fixed 30 days from issue** (deliberate deviation — see ADR-0002
Release-1 amendment), refreshed only by a future re-send.

### Vendor PO response

A vendor's response to a Purchase Order is a sequence of **distinct** transitions,
not a single "respond" action. Do not collapse these words.

**Acknowledge**:
The vendor confirms *receipt* of the PO. Transition `SENT → ACKNOWLEDGED`.
Means "I have seen this", not "I commit to it".
_Avoid_: confirm (overloaded — the API method is `confirm` but the domain verb is acknowledge), accept.

**Accept**:
The vendor *commits to fulfil* the PO. Transition `ACKNOWLEDGED → ACCEPTED`. May
also set commercial fields (payment terms, warehouse). This is the commercial
commitment, distinct from Acknowledge.
_Avoid_: acknowledge, approve (approve is the buyer-internal action).

**Decline** (vendor):
The vendor rejects the PO. Transition `SENT | ACKNOWLEDGED → CANCELLED_BY_VENDOR`,
with an optional reason.
_Avoid_: cancel (the buyer-side reject is "decline" → `CANCELLED`; the vendor-side
is "vendor-decline" → `CANCELLED_BY_VENDOR` — different actors, different states).

## Relationships

- A **Tokenised Vendor Link** grants an **Unactivated Vendor** access to exactly one
  document (here, one **Purchase Order**) and authorises **Acknowledge**, **Accept**,
  and **Decline** on it.
- The PO email chooses its "View" link by vendor state: an **Activated Vendor** gets the
  authenticated app link (routed through login to their dashboard); an **Unactivated
  Vendor** gets the **Tokenised Vendor Link**. The public page still tolerates a
  logged-in visitor (e.g. a forwarded link).
- **Acknowledge → Accept** is an ordered two-step commitment; **Decline** is available
  from either `SENT` or `ACKNOWLEDGED`.

## Flagged ambiguities

- "Acknowledge" was used loosely to mean the whole vendor response. Resolved: the
  tokenised link exposes the full set — **Acknowledge**, **Accept**, **Decline** —
  preserving the two-step Acknowledge→Accept lifecycle (not a single combined click).
- The API verb `confirm` (`POST :id/confirm`) implements the domain verb **Acknowledge**.
  Naming kept for back-compat; the domain term is "acknowledge".
