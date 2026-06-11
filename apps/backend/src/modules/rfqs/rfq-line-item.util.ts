import type { CreateRfqLineItemDto } from '@forethread/shared-types';

/**
 * The single, source-agnostic persisted shape of an RFQ line item (FOR-204).
 *
 * Regardless of whether a line item came from the product catalog or a parsed
 * BOM, it is stored the same way: catalog items keep their `materialId` (the
 * display name is read from the Material relation), while BOM items keep a
 * free-text `materialName` and have no catalog material yet.
 */
export interface NormalizedRfqLineItem {
  materialId: string | null;
  materialName: string | null;
  quantity: number;
  unit: string;
  costCode: string | null;
  description: string | null;
  notes: string | null;
  pickUp: boolean;
  projectId: string | null;
  deliveryLocationId: string | null;
  expectedDeliveryDate: Date | null;
}

/** Trim a possibly-blank string, collapsing empty/whitespace results to null. */
function blankToNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed;
}

/** True when a line item carries either a catalog material or a usable name. */
export function isValidRfqLineItemInput(li: CreateRfqLineItemDto): boolean {
  return Boolean(blankToNull(li.materialId)) || Boolean(blankToNull(li.materialName));
}

/**
 * Normalize an RFQ line-item input (from either source) to the persisted shape.
 *
 * - Catalog lines keep `materialId` and persist no `materialName` — the name is
 *   derived from the Material relation on read, keeping a single source of truth.
 * - BOM lines persist their `materialName` with `materialId = null`.
 * - Since US 5.05, buyer `notes` persist into the dedicated `notes` column;
 *   `description` carries the material description (it used to receive `notes`
 *   before the column existed — existing rows are unchanged).
 */
export function normalizeRfqLineItem(li: CreateRfqLineItemDto): NormalizedRfqLineItem {
  const materialId = blankToNull(li.materialId);
  const materialName = blankToNull(li.materialName);

  return {
    materialId,
    materialName: materialId ? null : materialName,
    quantity: li.quantity,
    unit: li.uom,
    costCode: blankToNull(li.costCode),
    description: blankToNull(li.description),
    notes: blankToNull(li.notes),
    pickUp: li.pickUp ?? false,
    projectId: blankToNull(li.projectId),
    deliveryLocationId: blankToNull(li.deliveryLocationId),
    expectedDeliveryDate: li.expectedDeliveryDate ? new Date(li.expectedDeliveryDate) : null,
  };
}

/**
 * Resolve the display name for a stored line item. The catalog material's name
 * wins when present; otherwise the BOM-sourced `materialName` is used.
 */
export function resolveRfqLineItemMaterialName(li: {
  material?: { name: string } | null;
  materialName?: string | null;
}): string {
  return li.material?.name ?? li.materialName ?? 'Material';
}

/** Collect the catalog material ids referenced by a set of line items. */
export function catalogMaterialIds(lineItems: CreateRfqLineItemDto[]): string[] {
  return lineItems.map((li) => li.materialId?.trim()).filter((id): id is string => Boolean(id));
}
