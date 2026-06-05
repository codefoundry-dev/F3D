---
name: rfq-line-item-source-enum-vs-zod
description:
  RFQ draft lineItems source field has a nominal type mismatch between the zod schema (string union)
  and the api-client DTO (enum); cast at the service call
metadata:
  type: project
---

In `apps/web`, the RFQ save-as-you-go service (`features/rfqs/buyer/services/rfqs.service.ts`)
passes zod-inferred `SaveRfqDraftValues` / `UpdateRfqValues` (from
`@forethread/shared-types/client`) straight into the api-client `saveRfqDraft` / `updateRfq`, which
are typed with the root DTO classes (`SaveRfqDraftDto` etc).

After FOR-204 added a `source` field, `lineItems[].source` is typed `'CATALOG' | 'BOM'` (string
union) by the zod schema but `RfqLineItemSource` (enum) by the api-client DTO. TypeScript treats
these as nominally incompatible even though runtime values are identical, so `tsc --noEmit` fails at
the service call.

**Why:** the frontend must import shared-types from `/client` (the root barrel drags in
@nestjs/swagger and breaks Vite — see user auto-memory `shared-types client boundary`), so the
api-client's root DTO type can't be imported into web code to align the types.

**How to apply:** when wiring new fields whose zod and DTO types diverge on enums, cast at the
service boundary with `dto as Parameters<typeof saveRfqDraft>[0]` rather than importing the root
DTO. The `RfqLineItemSource` enum itself IS available from `/client` (it's swagger-free) and can be
used in component/page code.
