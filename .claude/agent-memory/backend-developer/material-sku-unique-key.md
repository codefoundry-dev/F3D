---
name: material-sku-unique-key
description: Material.sku is the natural unique key; the (name,status) unique constraint was dropped in FOR-228
metadata:
  type: project
---

In the `materials` table, `sku` (`idx_material_sku`) is the natural unique key used for bulk catalogue upserts (`INSERT ... ON CONFLICT (sku) DO UPDATE` in `MaterialsService.importCatalogueFromExtraction`).

FOR-228 DROPPED the old `@@unique([name, status], map: "idx_material_name_status")` constraint — catalogue product names are NOT unique (verified up to 28 duplicates in the Rexel data). The plain `idx_materials_name` index remains (name is still indexed, just not unique).

Catalogue columns added to Material: `sku`, `brand`, `manufacturerPartNumber` (`manufacturer_part_number`), `subCategory` (`sub_category`), `imageUrl` (`image_url`). For imported catalogue rows, `manufacturer` = brand value (brand is the manufacturer for this data).

**How to apply:** do NOT reintroduce a name-based unique constraint on materials. SKU-less import rows fall back to case-insensitive name+status dedupe (the minority path). See [[doc-intelligence-catalogue-path]] for where the data comes from.
