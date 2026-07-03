# Procurement Platform — Domain Context

The shared language of the procurement platform. This file captures terms whose meaning is
load-bearing and easy to blur. It is grown lazily as decisions are sharpened; it is not an
exhaustive glossary.

## Language

### Vendor access

**Vendor**: An organization that supplies materials, addressed on a document by `vendorId`. Has two
states (see [ADR-0001](docs/adr/0001-vendors-are-email-first.md)):

- **Unactivated** — no one at the vendor can log in; the vendor acts entirely through tokenised
  links.
- **Activated** — at least one of its people has a real account (dashboard/login). Activation is
  always optional; every vendor action must work without it. Canonical test: a vendor is Activated
  iff ≥ 1 of its users has status `ACTIVE`. The mere existence of a `User` row does **not** activate
  a vendor — Sales Reps are persisted as `INVITED` users with no credentials.

**Sales Rep** (vendor representative): A person at a Vendor, stored as a vendor-role `User`.
Activation applies per-person, independent of the company:

- **Activated rep** — status `ACTIVE`; has credentials, uses the app.
- **Unactivated rep** — status `INVITED`; acts only through tokenised links. Splits into two
  sub-states, keyed off `invitationToken` presence:
  - **Contact-only** — no token; a contact record that may never have been emailed anything.
  - **Invite pending** — token minted, activation email sent, not yet accepted.
- **Deactivated rep** — status `INACTIVE`; receives **no** vendor-bound emails at all. A dead
  authenticated link would be noise, and a tokenised link would hand a deactivated person login-free
  authority over the document. A vendor company can hold a mix of all three at once.

**Rep Invitation**: The act of sending a Sales Rep their credentials-activation email (token →
`/activate` → login). Authority is relational, not vendor-internal: the vendor itself **or any
assigned contractor** (a buyer with a `CompanyVendorAssignment` to that vendor) may invite — the
same trust that lets a buyer trigger the very first vendor activation. Two invariants regardless of
who clicks:

- A **Deactivated rep** (`INACTIVE`) is never invited; reactivation is a separate, deliberate act.
- Inviting an **Activated rep** (`ACTIVE`) is a no-op — they have credentials.

**Cancel Invitation**: Revokes a pending Rep Invitation (clears the token). The rep **reverts to
contact-only** — still `INVITED`, still selectable on RFQs, still reachable via tokenised links.
Never destroys the rep record. _Avoid_: delete, remove — that is **Remove Representative**, a
different verb.

**Remove Representative**: Deliberately deletes the rep record itself. Must refuse — or downgrade to
deactivation (`INACTIVE`) — when the rep is referenced by RFQ contact selections, because document
history and live recipient resolution hang off those references.

**Tokenised Vendor Link**: A reusable, revocable link (backed by an `AccessToken`) that lets an
**Unactivated Vendor** view and act on a single document without logging in. It must produce the
_same result_ as the authenticated path (ADR-0001), and — for Release 1 — the token alone authorises
every action with no OTP ([ADR-0002](docs/adr/0002-action-token-policy.md)). Authority is scoped to
_(vendor, document)_, never to a person: all unactivated recipients at a vendor share the **same**
token/link, so revocation is per-document, not per-rep. Lifetime is per-document: RFQ/quote tokens
follow ADR-0002's "lifetime of the document"; **PO links are capped at a fixed 30 days from issue**
(deliberate deviation — see ADR-0002 Release-1 amendment). A vendor-bound PO email sent after the
window (e.g. a change-request notification) re-issues a fresh token rather than shipping a dead link
(blessed by the same amendment).

### Vendor PO response

A vendor's response to a Purchase Order is a sequence of **distinct** transitions, not a single
"respond" action. Do not collapse these words.

**Acknowledge**: The vendor confirms _receipt_ of the PO. Transition `SENT → ACKNOWLEDGED`. Means "I
have seen this", not "I commit to it". _Avoid_: confirm (overloaded — the API method is `confirm`
but the domain verb is acknowledge), accept.

**Accept**: The vendor _commits to fulfil_ the PO. Transition `ACKNOWLEDGED → ACCEPTED`. May also
set commercial fields (payment terms, warehouse). This is the commercial commitment, distinct from
Acknowledge. _Avoid_: acknowledge, approve (approve is the buyer-internal action).

**Decline** (vendor): The vendor rejects the PO. Transition
`SENT | ACKNOWLEDGED → CANCELLED_BY_VENDOR`, with an optional reason. _Avoid_: cancel (the
buyer-side reject is "decline" → `CANCELLED`; the vendor-side is "vendor-decline" →
`CANCELLED_BY_VENDOR` — different actors, different states).

## Relationships

- **Rep authority follows activation: the buyer manages contacts; the vendor manages accounts.**
  Until a rep activates, any assigned contractor may add, invite, cancel-invite, and remove them —
  they are contact records at a vendor that may have no one able to log in. The moment a rep is
  `ACTIVE`, account authority transfers to the vendor (and super-admin): buyers can no longer remove
  or deactivate them, and `INACTIVE` reps are the vendor's to reactivate or bury. (Buyers always
  control their _own_ RFQ recipient selections — that is document editing, not account management.)
- **A Sales Rep is viewed inside the vendor context, never under user management.** "Users" means
  _my own company's people_ (invite, deactivate, roles). A counterparty's people — a vendor's Sales
  Reps seen by a buyer — are part of the **Vendor** (vendor list, vendor profile, rep detail) and
  are reached through it. The two areas answer different questions: "who works for me" vs. "who do I
  deal with at this supplier".

- A **Tokenised Vendor Link** grants an **Unactivated Vendor** access to exactly one document (here,
  one **Purchase Order**) and authorises **Acknowledge**, **Accept**, and **Decline** on it.
- Every vendor-bound PO email (issue, change-request proposed, and future lifecycle notifications)
  chooses its "View" link **per recipient**, not per vendor: an **Activated rep** (`ACTIVE` user)
  gets the authenticated app link (routed through login to their dashboard); an **Unactivated rep**
  (`INVITED` user) or company contact email gets the **Tokenised Vendor Link**. Recipients at the
  same vendor may therefore receive different link types in the same send. The public page still
  tolerates a logged-in visitor (e.g. a forwarded link).
- The RFQ invitation is the deliberate exception: **every** recipient — activated or not — gets the
  tokenised guest link, because the invitation endpoint serves both audiences (FOR-201). Do not
  "fix" either path to match the other.
- The awarded PO resolves its recipients **live at issue time** from the source RFQ (`po.rfqId` →
  `RfqVendor` → `RfqVendorContact`); the selection is single-sourced on the RFQ, so editing the
  RFQ's reps before the PO is issued changes who receives the PO. Nothing is snapshotted onto the
  PO.
- **Acknowledge → Accept** is an ordered two-step commitment; **Decline** is available from either
  `SENT` or `ACKNOWLEDGED`.
- **Sales-rep selection governs the whole RFQ→PO thread.** The reps a buyer selects when sending an
  RFQ are also the recipients of the issue email on any PO awarded from that RFQ (per vendor). A
  manual PO (no source RFQ), or a vendor with no selection, falls back to all vendor users, then the
  company contact email — the same fallback contract the RFQ send uses.

## Flagged ambiguities

- "Cancel invitation" historically **deleted the User row** — defensible when a rep only existed
  because of an invite, wrong once reps can be added without one (FOR-272). Resolved: cancel =
  revoke token (revert to contact-only); destruction is the separate **Remove Representative** verb.

- "Acknowledge" was used loosely to mean the whole vendor response. Resolved: the tokenised link
  exposes the full set — **Acknowledge**, **Accept**, **Decline** — preserving the two-step
  Acknowledge→Accept lifecycle (not a single combined click).
- The API verb `confirm` (`POST :id/confirm`) implements the domain verb **Acknowledge**. Naming
  kept for back-compat; the domain term is "acknowledge".
- "Activated" had two competing implementations: the vendor list used "≥ 1 `ACTIVE` user" while the
  PO-issue email used "≥ 1 user row of any status", so adding Sales Reps (persisted as `INVITED`
  users) silently flipped a vendor to Activated and suppressed the tokenised PO link. Resolved:
  activation requires an `ACTIVE` user, and the PO email picks its link per recipient, not per
  vendor.
