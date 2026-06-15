---
name: material-catalogue-feature
description: FOR-228 catalogue ingest UI — where the catalogue list/import lives and how it reuses doc-intelligence
metadata:
  type: project
---

The material catalogue feature (`apps/web/src/features/material-catalogue/`) is built out (was a
"Coming soon" stub). FOR-228 "Catalogue ingest".

- `pages/MaterialCataloguePage.tsx` — searchable + paginated catalogue list (GET /v1/materials) +
  an "Import catalogue" button opening `CatalogueImportModal`.
- `components/CatalogueImportModal.tsx` — upload→poll→review→confirm→import flow. REUSES the
  doc-intelligence extraction hooks (`useCreateDocExtraction`, `useDocExtractionQuery`,
  `useConfirmDocExtraction` from `../../doc-intelligence`) with `type: 'CATALOGUE'`. After confirm it
  calls `useCatalogueImport` (POST /v1/materials/catalogue-import).
- `components/CatalogueReviewTable.tsx` — client-side paginated (25/page) + debounced-search review
  table over the in-memory `CatalogueExtractionResult.items`. Handles 50k+ rows: never renders all
  rows, edits/deletes target the canonical array index (carried alongside the filtered row). NEVER
  displays the `confidence` field.
- `hooks/useMaterials.ts` (list, `keepPreviousData`) + `hooks/useCatalogueImport.ts`.

**Why:** backend was already live; UI mirrors the doc-intelligence BOM upload/review patterns.

**How to apply:** when extending catalogue or adding another doc-extraction-backed flow, reuse the
doc-intelligence upload/poll hooks with a new `type` rather than rewriting upload+poll.

## api-client changes made (drift fixes)

- `DocExtractionType` union gained `'CATALOGUE'`.
- `MATERIALS_PATHS.CATALOGUE_IMPORT` + `importCatalogue()` + `CatalogueImportSummary` added.
- `MaterialListItemDto` (in api-client) was STALE: it has `code`/`unitOfMeasure`/`updatedAt` that
  several rfqs consumers still read, but the real backend returns `uom`/`sku`/`brand`/`categoryName`
  etc (the shared-types `material.dto.ts` shape). I added the new catalogue fields as OPTIONAL to
  the api-client DTO instead of replacing the old ones — replacing would break
  `StepMaterials`/`MaterialSearchPopup`/`MaterialDetailPage` which read `unitOfMeasure`/`code`.
  GOTCHA: api-client `MaterialListItemDto` and shared-types `MaterialListItemDto` are DIFFERENT
  shapes; the api-client one is the drifted/legacy one.

## i18n

- New namespace `materialCatalogue` registered in `packages/i18n/src/config.ts` (import + resources
  entry). Plural keys (`actions.import_one`, `review.itemCount_one`) work with i18next count.

## US 4.02 / 4.03 (favourites + material lists, contribute-to-catalogue)

- **Role split in `MaterialCataloguePage`**: tabs are gated on `has('material.approve')`. SA
  (approver) keeps `public/pending/archived`; CA/PO (contributor, `!canApprove`) get
  `public/favorites/materialList`. `validTabKeys` drives both the tab bar AND `?tab=` resolution so
  an out-of-role tab param falls back to `public`. Keep the SA branch untouched — it's a hard
  requirement.
- **Success-modal branching gotcha**: CreateMaterialPage + Edit{Core,Additional}Page now show a
  `MaterialCatalogueSuccessModal` (wraps shared `StatusSuccessModal`, 3s auto-redirect) for
  contributors. Create → "contribute" variant always for `!approve`. Edit → "changeSubmitted"
  variant ONLY when `!approve && material.status === 'PUBLIC'` (a change request was created);
  own-private edits + SA keep the old toast+navigate. This BROKE the 3 existing page tests (they ran
  with empty perms = contributor and expected detail-page nav) — fixed by mocking `@/shared/role`
  `usePermissions` and defaulting `permissionSet` to `['material.approve']` in beforeEach, then
  adding contributor-path cases. Pattern: those page tests previously did NOT mock permissions.
- **MaterialTable optional columns**: `onToggleFavourite` adds a leading star column (inline SVG, no
  star asset exists in ui-components), `onAddToList` adds an "Add to material list" kebab action,
  `onRemoveFromList` adds a remove-X (`cross.svg`) button. All opt-in via prop presence so the SA
  table is unchanged. `emptyText` prop overrides the empty-state copy (favourites tab).
- **Favourites optimistic toggle** (`useMaterialFavouriteMutations`): `queryClient.setQueriesData`
  over `queryKeys.materials.all()` flips `isFavourite` across every cached list page; rolls back +
  toasts on error; invalidates on settle. PUT/DELETE `/materials/:id/favourite`.
- **Material lists** (`useMaterialLists`): query keys added to api-client `queryKeys.materialLists`
  (all/list/detail). `MaterialListDetailPage` reuses `MaterialTable` by projecting
  `MaterialListEntryDto.material` → `MaterialListItemDto` (entryToRow) and keeps a
  material.id→entry.id map so remove-X resolves the LIST-ITEM id (not material id) for
  DELETE `/material-lists/:id/items/:itemId`.
- **Route order**: `/material-catalogue/lists/:id` literal `lists` segment MUST be registered before
  `/material-catalogue/:id` in routes.tsx or it's swallowed by the detail route.
- **ConfirmMaterialModal** gained optional `title`/`body`/`confirmLabel` overrides so it doubles as
  the list-delete confirm without new copy-specific components.
- api-client `MaterialListItemDto` + `MaterialDetailDto` gained optional `companyId`/`isFavourite`;
  `MaterialListQueryParams` gained `favourite?: boolean`.
