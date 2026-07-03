# ADR-0016: Sales-rep lifecycle authority is relational and follows activation

**Status:** Accepted **Date:** 2026-07-02

## Context

FOR-272 let buyers add Sales Reps as contact-only `User` rows (role `VENDOR`, status `INVITED`, no
token, no email). But the invite/resend/cancel endpoints remained hard-guarded to the vendor's own
users — and per ADR-0001, most vendors are Unactivated, meaning **no one at the vendor can log in to
click "Invite"**. A buyer-added rep at an unactivated vendor was therefore permanently stranded:
authenticatable in principle, invitable by no one.

Separately, "cancel invitation" deleted the whole `User` row — defensible when a rep only existed
_because of_ an invite, wrong once reps exist independently as contacts (and dangerous:
`RfqVendorContact.userId` has no cascade, so the delete throws for any rep selected on an RFQ, and
RFQ→PO recipient resolution hangs off those rows).

## Decision

Authority over a rep is **relational** (vendor or any assigned contractor via
`CompanyVendorAssignment`) until the rep activates, then transfers to the vendor. One line: **the
buyer manages contacts; the vendor manages accounts.**

- **Never activated** (contact-only or invite-pending): any assigned contractor may add, **invite**,
  resend, cancel-invite, and remove the rep. This extends the same trust that already lets a buyer
  trigger the very first vendor activation email (`POST /vendors/invite`).
- **`ACTIVE`**: only the vendor (and super-admin) may deactivate or remove. A customer of the vendor
  must never be able to kill a real login — and once a rep is ACTIVE the vendor is Activated and can
  self-manage, so the chicken-and-egg justification is gone.
- **`INACTIVE`**: reactivation/removal is likewise vendor-side; deactivated reps receive no
  vendor-bound emails, so no one may "invite" them back.

Cancel Invitation and Remove Representative are **distinct verbs**: cancel revokes the token and
reverts the rep to contact-only (non-destructive); remove deletes the record and must refuse — or
downgrade to deactivation — when RFQ contact references exist.

## Alternatives considered

- **Vendor-only invites (status quo).** Rejected: strands every buyer-added rep at an unactivated
  vendor; makes the FOR-272 flow a dead end.
- **Buyer keeps full authority over reps they created, even after activation.** Rejected: "who
  created the row" is invisible and arbitrary from the rep's perspective; activation is the legible
  boundary, and it is the moment the vendor gains the ability to self-manage.
- **Auto-invite on add.** Rejected: FOR-272 deliberately separated "exists as a contact" from "was
  emailed an invite"; collapsing them re-breaks the vendor-activation semantics that CONTEXT.md's
  activation test depends on.
