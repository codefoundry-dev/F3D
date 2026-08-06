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

### Vendor categorisation

**Vendor Category**: What a Vendor supplies, expressed as one or more values of the `VendorCategory`
enum (`ELECTRICAL`, `PLUMBING`, …). It is a **relationship fact, not a vendor fact**: the category
is declared by the **contractor** on their `CompanyVendorAssignment`, so two contractors may
categorise the same vendor differently and each sees only their own
([ADR-0018](docs/adr/0018-vendor-category-is-a-per-contractor-relationship-fact.md)). Chosen over
vendor self-declaration because vendors are email-first (ADR-0001) — an Unactivated Vendor never
logs in, so any vendor-owned tag would be permanently empty for exactly the vendors reached by
tokenised link. _Avoid_: **group** — that word already means "the Sales Reps at one company,
collapsed into one row" (`useGroupedVendors`); **specialisation** — the retired vendor-declared
free-text field; **trade** — unused, adds a fourth synonym.

**Vendor Specialisation** (retired as authority): The vendor's own free-text claim about what it
supplies, on `Company.specialisations`. It is **descriptive only** — no filter, no RFQ recipient
selection, and no grouping may read it. It survives on the vendor profile and the company PDF
export, and may _prefill_ a contractor's Vendor Categories when a vendor is attached, but never
overrides them. Anything that needs to know what a vendor supplies reads the **Vendor Category**.

**Category filter → Add All**: The way a buyer sends one RFQ to every vendor in a category. There is
no stored "group" to send to — the recipient set is a _query_ over Vendor Categories, resolved at
selection time in the RFQ wizard and then frozen as ordinary `RfqVendor` rows. A vendor
recategorised afterwards does not join or leave an RFQ already sent.

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

- **Vendor Category is a per-contractor opinion, not a property of the vendor.** The same vendor may
  be `ELECTRICAL` to one contractor and `GENERAL_RETAILER` to another; neither is wrong and neither
  is visible to the other. This is why it lives on `CompanyVendorAssignment` and not on `Company`.
- **Bulk selection may never reach a recipient a single selection could not.** "Filter → Add All" is
  a convenience over the same rules that govern picking one rep by hand — in particular a
  **Deactivated rep** is never selectable and never emailed, on the RFQ path exactly as on the PO
  path. Any widening of selection must preserve this.

## Flagged ambiguities

- "Cancel invitation" historically **deleted the User row** — defensible when a rep only existed
  because of an invite, wrong once reps can be added without one (FOR-272). Resolved: cancel =
  revoke token (revert to contact-only); destruction is the separate **Remove Representative** verb.

- "What does this vendor supply" had **two live fields and no precedence**:
  `Company.specialisations` (vendor-owned, free text, forced to a single value by the create modal)
  and `CompanyVendorAssignment.categories` (contractor-owned, typed, multi — and written by nothing
  but the seed, so the RFQ wizard's category filter was permanently empty).
  `useGroupedVendors.ts:23` was quietly papering over it by falling back from one to the other.
  Resolved by [ADR-0018](docs/adr/0018-vendor-category-is-a-per-contractor-relationship-fact.md):
  `categories` is authoritative, `specialisations` is a descriptive claim, the fallback goes.

- "Deactivated reps receive no vendor-bound emails" held on the PO path (`sendableRecipients` drops
  `INACTIVE`) but **not** on the RFQ path — `resolveSelectedRecipients` never filtered on status,
  and the send query did not even select it. The vendor picker compounded it by rendering every non-
  `ACTIVE` rep as `INVITED`, hiding deactivated people from the buyer choosing recipients. Resolved:
  the RFQ path filters `INACTIVE` like the PO path, and the picker shows deactivation as its own
  state.

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
