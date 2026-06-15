# Backend Developer Memory Index

- [doc-intelligence catalogue path](doc-intelligence-catalogue-path.md) — CATALOGUE spreadsheets parse Excel directly (no Gemini); only CATALOGUE PDFs use the LLM. BOM/QUOTE spreadsheets still use Gemini.
- [material sku unique key](material-sku-unique-key.md) — Material SKU is the natural unique key; (name,status) unique was dropped because catalogue names are not unique.
- [material company scope + favourites](material-company-scope-favourites.md) — US 4.02/4.03: materials.company_id ownership envelope (PUBLIC vs company-private), edit/approve/restore/import rules, MaterialFavourite, material-lists CRUD.
- [PO/bulk/drawdown flows](po-bulk-drawdown-flows.md) — US5.08/5.09 + PO Change Request: canonical changedFields shape, approveChange (was a no-op stub) now applies+audits, PoChangeRequest.reference, drawdown-from-PO in createPurchaseOrder, GET /rfqs/approved-responses; $transaction-mock test gotcha.
