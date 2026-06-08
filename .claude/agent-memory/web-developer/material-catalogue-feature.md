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
