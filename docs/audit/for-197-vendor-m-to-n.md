# Vendor Many-to-Many Audit (FOR-197)

**Ticket:** FOR-197 **Date:** 2026-05-22 **Branch:** main **Auditor:** ohenekwabena

## TL;DR

The schema is correctly modelled as M:N (`CompanyVendorAssignment` join table between contractor and
vendor companies). The list/profile query layer for vendors already uses that join correctly. The
1:1 leak lives in three concrete places:

1. **Backend — `CompaniesService.createCompany`**: when a contractor uses the "Create vendor
   company" UI, no de-dup by `contactEmail` or `abn` runs. A second contractor creating the same
   vendor produces a duplicate `Company` row.
2. **Frontend — `useInviteVendorForm`**: the company dropdown is populated from `useVendors()`,
   which only returns vendors already assigned to the current contractor. There is no path to pick
   an existing platform vendor that isn't yet on your list — so the user is forced into "Create
   vendor company" and triggers #1.
3. **Seed data**: only one contractor exists, so the M:N case is never exercised in dev or QA.

The RFQ → quote loop itself is M:N-safe (PO/BulkOrder/Invoice/QuoteResponse all key on
`(companyId, vendorId)` separately), but `RfqsService.createRfq` / `updateRfq` validate vendor IDs
only by `type = VENDOR`, not by whether the vendor is assigned to the contractor — a soft scope leak
rather than a duplication source.

---

## Where the M:N model is correct

| Layer   | Location                                                                      | Notes                                                                                                 |
| ------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Schema  | `apps/backend/src/prisma/schema/company.prisma:79-93`                         | `CompanyVendorAssignment(vendorId, contractorId)` with `@@unique([vendorId, contractorId])`. Correct. |
| Schema  | `rfq.prisma`, `purchase-order.prisma`, `bulk-order.prisma`, `invoice.prisma`  | All separate `companyId` (contractor) from `vendorId`. Correct.                                       |
| Backend | `VendorsService.listVendors` (`vendors.service.ts:49-168`)                    | Queries via `companyVendorAssignment` filtered by `contractorId`. Correct.                            |
| Backend | `VendorInviteService.inviteVendor` (`vendor-invite.service.ts:25-110`)        | When inviting by email, looks up existing vendor by `contactEmail` and adds the assignment. Correct.  |
| Backend | `CompaniesService.assignVendorsToContractor` (`companies.service.ts:256-290`) | Uses `createMany` with `skipDuplicates`. Correct.                                                     |

## Where the 1:1 behaviour leaks

### 1. `CompaniesService.createCompany` — duplicate vendor rows

**File:** `apps/backend/src/modules/companies/companies.service.ts:184-224`

The "Create vendor company" path goes straight from DTO → `prisma.company.create`, with no lookup
for an existing vendor sharing the same `contactEmail` or `abn`. Two contractors creating "Rexel" on
the same platform get two separate `Company` rows.

**Fix:** before `company.create`, do a `findFirst` on `(type: VENDOR, OR: [contactEmail, abn])`. If
found, just create the assignment and return the existing company.

### 2. `useInviteVendorForm` — UI can't see other contractors' vendors

**File:** `packages/vendor-shared/src/hooks/useInviteVendorForm.ts:46-65`

`companyOptions` is derived from `useVendors()`, which calls `GET /vendors` (already scoped by
contractor). Result: the dropdown only shows vendors you've already invited. The "Add Vendor
Company" action item in the dropdown is the only escape hatch — and it routes through #1.

**Fix:** rely on the email path. `inviteVendor` already de-dups by `contactEmail`, so leaving the
modal alone is fine — but `createCompany` must stop creating duplicates (fix #1) so the side door is
safe.

### 3. `RfqsService.createRfq` / `updateRfq` — vendor scope leak

**File:** `apps/backend/src/modules/rfqs/rfqs.service.ts:424-430`, `549-557`

Both validate vendor IDs only by `type = VENDOR`. Nothing checks the vendor is in the contractor's
`CompanyVendorAssignment` list, so a contractor could RFQ to a vendor they don't have a relationship
with by guessing IDs. Not a duplicate source, but worth tightening alongside #1.

**Fix:** add `assignments: { some: { contractorId: user.companyId } }` to the vendor `findMany`
validation in both methods (relation name: `vendorAssignments` on the vendor side).

### 4. Seed data — single contractor

**File:** `apps/backend/prisma/seed.ts`

Only `Test Contractor Pty Ltd` exists. All vendor assignments point at it, so the M:N model never
gets exercised in local dev or in QA's environment. This is why the leak went unnoticed.

**Fix:** add a second contractor (e.g. `Northside Builders`) and seed `Rexel` as a vendor assigned
to both. Run an RFQ through the existing contractor and a second RFQ through the new contractor,
both reaching the same `Rexel` company row.

---

## What this PR changes

- `companies.service.ts` — `createCompany` de-dups vendors by `contactEmail` / `abn` and reuses the
  existing row.
- `rfqs.service.ts` — vendor validation in `createRfq` / `updateRfq` is scoped to the contractor's
  assignments.
- `seed.ts` — adds `Northside Builders` (contractor) and `Rexel Electrical Supplies` (vendor)
  attached to both contractors, with one RFQ and quote per contractor through Rexel.
- Tests — unit tests for the de-dup branch in `CompaniesService`; e2e test that creates an RFQ from
  each contractor to the same Rexel `companyId` and asserts no duplicate `Company` rows.
