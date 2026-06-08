---
name: doc-intelligence-catalogue-path
description: How the CATALOGUE doc-extraction type diverges from BOM/QUOTE — direct Excel parse vs Gemini
metadata:
  type: project
---

The doc-intelligence module (`apps/backend/src/modules/doc-intelligence`) has a `CATALOGUE` extraction type (FOR-228) that intentionally breaks the uniform "everything goes through Gemini" pattern.

- CATALOGUE + spreadsheet mime → parsed DIRECTLY by `spreadsheetToCatalogue` in `doc-intelligence.catalogue.ts` (exceljs, no LLM, deterministic confidence=1). No Gemini config required; size cap raised to 30MB (vs 10MB).
- CATALOGUE + PDF/image → Gemini with the CATALOGUE prompt, then `normalizeCatalogueResult`.
- BOM/QUOTE spreadsheets are UNCHANGED — they still serialise to text and go through Gemini.

**Why:** real catalogues are huge (a Rexel export is ~62k rows / 11.7MB) and already tabular, so LLM extraction is slow, costly, and lossy. The branch lives in `runExtraction`, gated by `isDirectCatalogueParse(type, mime)`.

**How to apply:** when touching the extraction pipeline, do not assume every job calls Gemini. Catalogue matching (`matchBomToCatalogue`) is BOM-only — catalogues are never matched. See [[material-sku-unique-key]] for the import side.
