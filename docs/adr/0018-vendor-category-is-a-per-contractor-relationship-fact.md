# ADR-0018: Vendor Category is a per-contractor relationship fact

**Status:** Accepted **Date:** 2026-08-06

## Context

Buyers need to send one RFQ to every vendor in a trade — "all my Electrical suppliers". The RFQ
wizard already implements the mechanism: `SelectVendorsCard` builds a category dropdown, filters the
table, and "Add All" sweeps the result. It has never worked, because the field it reads —
`CompanyVendorAssignment.categories` — is written by **no code path except `seed.ts`**.

Meanwhile a second field answers the same question. `Company.specialisations` (`String[]`, free
text) is written by `CreateVendorCompanyModal` — required, single-select, over the `VendorCategory`
enum, then stored as a one-element array — and by the vendor's own profile form. It drives the
vendor-list filter. `useGroupedVendors.ts:23` reads `categories` and silently falls back to
`specialisations`, mixing a typed enum with free text in one array.

So the platform had two live answers to "what does this vendor supply", no stated precedence, and
the one the RFQ flow depended on was always empty.

## Decision

**`CompanyVendorAssignment.categories` is authoritative.** A Vendor Category is a fact about the
_relationship_ between a contractor and a vendor, not a property of the vendor. The same vendor may
be `ELECTRICAL` to one contractor and `GENERAL_RETAILER` to another; neither is wrong, and neither
is visible to the other.

`Company.specialisations` is **demoted to a self-declared claim**: descriptive on the vendor profile
and the company PDF export, permitted to _prefill_ a contractor's categories on attach, but read by
no filter, no grouping, and no recipient selection. The `useGroupedVendors` fallback is deleted.

The deciding constraint is ADR-0001: vendors are email-first and activation is always optional. A
vendor-owned tag can only be set by someone who logs in, so it would be permanently empty for
exactly the Unactivated Vendors that the tokenised-link flow exists to serve — the filter would stay
as empty as it is today.

Canonical term is **Vendor Category**. "Group" is not available: `useGroupedVendors` / `VendorGroup`
/ `CompanyGroupRow` already use it for "the Sales Reps at one company, collapsed into one row".

## Consequences

- **Selection is a query, not a stored set.** There is no group entity. The recipient set is
  resolved at selection time and frozen as ordinary `RfqVendor` rows; recategorising a vendor
  afterwards does not add or remove it from an RFQ already sent.
- **Category filtering and "Add All" move server-side.** Client-side filtering over a `limit: 100`
  page would make "all Electrical vendors" silently mean "those among the 100 most recently added",
  and would offer only the categories page 1 happens to hold. Add All resolves through its own
  endpoint that ignores pagination.
- **Bulk selection may not reach a recipient a single selection could not.** Add All is a
  convenience over the existing rules, so `INACTIVE` reps are excluded server-side — closing a live
  gap where the RFQ path (`resolveSelectedRecipients`) emailed deactivated reps while the PO path
  (`sendableRecipients`) correctly did not, against CONTEXT.md's stated invariant.
- **Untagged vendors must stay visible.** Category is required only on the create-new path (as it
  already is); the invite and add-existing paths leave it optional, so the filter carries an
  explicit **Uncategorised** bucket rather than letting untagged vendors silently drop out of every
  send.
- **No cross-tenant reuse.** Each contractor tags its own vendors. A future global taxonomy would
  have to reconcile conflicting per-tenant opinions — this is the expensive direction, and it is
  chosen deliberately.

## Alternatives considered

- **Vendor-owned tags (`Company.specialisations` promoted to the enum, multi-select).** Rejected on
  ADR-0001: Unactivated Vendors can never set it, so the filter stays empty for the majority of the
  vendor book. One global truth is worth less than a truth that exists.
- **Both, with vendor self-declaration overridden by the contractor.** Rejected: best data quality,
  but it makes two fields permanently load-bearing and requires a precedence rule forever — the
  `useGroupedVendors.ts:23` fallback is an unplanned version of exactly this, and it is the defect
  being closed.
- **Named curated groups as a first-class entity** ("Preferred Sparkies — Sydney"). Rejected for
  now: a new table, CRUD UI, and membership-lifecycle rules, when a taxonomy facet satisfies the
  stated need and the wizard already assumes one. Revisit if buyers need sets that cut across trade,
  region, and commercial tier at once.
- **Dropping `Company.specialisations` entirely.** Rejected: destroys vendor-entered data and
  removes the vendor's only means of stating what it supplies. Demotion gets the single authority
  without the loss.
