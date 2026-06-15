---
name: material-company-scope-favourites
description: US 4.02/4.03 — materials.company_id ownership envelope + per-user MaterialFavourite, and how visibility/approval flows
metadata:
  type: project
---

US 4.02 added `materials.company_id` (nullable). NULL ⇒ a PUBLIC, shared catalogue row; a non-null company_id is a company-PRIVATE row visible only to that company until approved.

Visibility envelope (the recurring pattern, used in list/suggestions/detectDuplicates/BOM-match): a non-SUPER_ADMIN sees `OR: [{status: PUBLIC}, {companyId: user.companyId ?? '__none__'}]`. `'__none__'` is an unmatchable sentinel so a company-less user sees only PUBLIC. In `buildListWhere` an explicit `status` query is AND-ed INSIDE this envelope (`where.AND = [envelope, {status}]`), so a PENDING/ARCHIVED tab shows only the company's own unpublished rows.

Ownership/edit rules in `MaterialsService.updateMaterial`: SUPER_ADMIN → direct apply; non-SA editing their OWN private draft (companyId === user.companyId AND status !== PUBLIC) → direct apply (no approval queue); non-SA editing a PUBLIC row → MaterialChangeRequest (the Phase-3 approval queue); cross-company private → 404. `isMaterialVisible()` is the shared guard.

Status transitions (`MaterialStatusService`): approve sets `company: { disconnect: true }` (Prisma relation, NOT `companyId: null` — that fails typecheck) to promote private→PUBLIC. restore branches on companyId: private (set) → PENDING_APPROVAL, public (null) → PUBLIC.

Import (`importCatalogueFromExtraction`): non-SA imports land as PENDING_APPROVAL + companyId; the SKU raw upsert guards the conflict with `WHERE materials.company_id IS NOT DISTINCT FROM <companyId>` so a company import can't demote/overwrite a PUBLIC or foreign-company row (those conflicting SKUs are skipped). `upsertByName` dedupe is scoped by `{status, companyId}`.

US 4.03 — `MaterialFavourite (user_id, material_id)` unique = idempotent. `addFavourite` = upsert + visibility 404; `removeFavourite` = deleteMany (no-op safe, no visibility check needed since scoped to own rows). List/detail carry `isFavourite` (list resolves it in ONE batched `findMany`, no N+1) and `companyId`. `MaterialListQueryDto.favourite=true` → `where.favourites = { some: { userId } }`.

Material-lists CRUD (US 4.03) lives in `MaterialListsService`; write paths guard via `assertListInCompany` (findFirst {id, companyId} or 404). addItems validates every materialId is company-visible before `createMany({skipDuplicates:true})`.

See [[material-sku-unique-key]] and [[doc-intelligence-catalogue-path]]. Migration: `20260613120000_us402_403_company_scope_favourites` (hand-written, idempotent, deployed to dev 5433).
