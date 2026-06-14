import type { RfqDetail, BulkOrderDetail, PoDetail } from '@forethread/api-client';
import { PickUpTimeExpectation } from '@forethread/shared-types/client';

import type { FormValues, LockedField } from '../schemas/create-po.schema';
import { EMPTY_LINE_ITEM } from '../schemas/create-po.schema';

interface SourceFormDefaults {
  defaultValues: Partial<FormValues>;
  lockedFields: Set<LockedField>;
}

/**
 * Convert an approved RFQ into form defaults + locked fields for the PO wizard.
 *
 * Locks: projectId, deliveryLocationId, plannedDeliveryDate
 * (vendor is prefilled but editable)
 */
export function rfqToFormDefaults(rfq: RfqDetail): SourceFormDefaults {
  const lineItems: FormValues['lineItems'] = rfq.lineItems.map((li) => ({
    ...EMPTY_LINE_ITEM,
    materialName: li.materialName,
    description: li.description ?? '',
    unitOfMeasure: li.unit,
    quantityOrdered: li.quantity,
    expectedDeliveryDate: li.expectedDeliveryDate ?? '',
    deliveryLocationId: '',
  }));

  // Find the first approved vendor to prefill
  const approvedVendor = rfq.vendors.find((v) => v.approved);

  const defaultValues: Partial<FormValues> = {
    documentName: rfq.name ? `PO — ${rfq.name}` : '',
    projectId: rfq.projectId,
    vendorId: approvedVendor?.id ?? '',
    deliveryLocationId: '',
    plannedDeliveryDate: rfq.deadlineEnd ?? rfq.needByDate ?? '',
    lineItems: lineItems.length > 0 ? lineItems : [{ ...EMPTY_LINE_ITEM }],
  };

  const lockedFields = new Set<LockedField>([
    'projectId',
    'deliveryLocationId',
    'plannedDeliveryDate',
  ]);

  return { defaultValues, lockedFields };
}

/**
 * Resolved identifiers a caller can supply for a bulk-order-sourced PO. The
 * bulk-order detail response carries human-readable names (projectName,
 * vendorName) but not the UUIDs the wizard binds to, so the caller resolves
 * them (e.g. by matching names against the project/vendor lists) and passes
 * them in here.
 */
export interface BulkOrderFormSourceIds {
  projectId?: string;
  vendorId?: string;
}

/**
 * Convert a Bulk Order into form defaults + locked fields for the PO wizard.
 *
 * Drawdown (US 5.09): when `ids.projectId` / `ids.vendorId` are supplied, both
 * are prefilled and locked (the PO must target the bulk order's project +
 * vendor), and each line carries `bulkOrderLineItemId` + `availableQty`
 * (= `qtyRemaining`) so the wizard can draw down against the right line and
 * cap the ordered quantity.
 *
 * Locks: vendorId (always), projectId (only when resolved).
 */
export function bulkOrderToFormDefaults(
  bo: BulkOrderDetail,
  ids: BulkOrderFormSourceIds = {},
): SourceFormDefaults {
  const lineItems: FormValues['lineItems'] = bo.lineItems.map((li) => ({
    ...EMPTY_LINE_ITEM,
    materialName: li.description || li.itemReference,
    materialCode: li.itemReference ?? '',
    unitOfMeasure: li.unit,
    unitPrice: li.pricePerUnit,
    quantityOrdered: li.qtyRemaining > 0 ? li.qtyRemaining : li.qty,
    bulkOrderLineItemId: li.lineItemId,
    availableQty: li.qtyRemaining,
  }));

  const defaultValues: Partial<FormValues> = {
    documentName: bo.projectName ? `PO — ${bo.projectName}` : '',
    projectId: ids.projectId ?? '',
    vendorId: ids.vendorId ?? '', // Falls back to resolution-by-name in the page
    lineItems: lineItems.length > 0 ? lineItems : [{ ...EMPTY_LINE_ITEM }],
  };

  const lockedFields = new Set<LockedField>(['vendorId']);
  if (ids.projectId) lockedFields.add('projectId');

  return { defaultValues, lockedFields };
}

/** Map a PO `pickUpTimeExpectation` string back to the form enum (or undefined). */
function toPickUpTimeExpectation(value: string | null): FormValues['pickUpTimeExpectation'] {
  if (!value) return undefined;
  return (Object.values(PickUpTimeExpectation) as string[]).includes(value)
    ? (value as FormValues['pickUpTimeExpectation'])
    : undefined;
}

/**
 * FLOW 3 — convert an existing {@link PoDetail} into PO-wizard form defaults for
 * change mode. Every field the change diff can touch is pre-filled, and each
 * line carries its existing PO line `id` (as `lineItemId`) so the diff can match
 * edited rows against the original PO. Line-level delivery location is left
 * blank because the detail only exposes the location *name* (not its id) and
 * that field is not part of the per-line change allowlist anyway.
 *
 * The document name is returned pre-filled; the wizard locks it in change mode.
 */
export function poToFormDefaults(po: PoDetail): { defaultValues: Partial<FormValues> } {
  const lineItems: FormValues['lineItems'] = po.lineItems.map((li) => ({
    ...EMPTY_LINE_ITEM,
    lineItemId: li.id,
    materialName: li.materialName ?? li.description ?? '',
    materialCode: li.materialCode ?? '',
    costCode: li.costCode ?? '',
    unitOfMeasure: li.unitOfMeasure,
    unitPrice: li.unitPrice,
    quantityOrdered: li.quantityOrdered,
    expectedDeliveryDate: li.expectedDeliveryDate ? li.expectedDeliveryDate.slice(0, 10) : '',
    description: li.description ?? '',
    notes: li.notes ?? '',
  }));

  const defaultValues: Partial<FormValues> = {
    documentName: po.documentName ?? po.poNumber ?? '',
    projectId: po.projectId,
    vendorId: po.vendor?.id ?? '',
    paymentTermsDays: po.paymentTermsDays ?? undefined,
    deliveryLocationId: po.deliveryLocationId ?? '',
    plannedDeliveryDate: po.plannedDeliveryDate ? po.plannedDeliveryDate.slice(0, 10) : '',
    pickUp: po.pickUp ?? false,
    pickUpTimeExpectation: toPickUpTimeExpectation(po.pickUpTimeExpectation),
    holdForRelease: po.holdForRelease ?? false,
    message: po.message ?? '',
    lineItems: lineItems.length > 0 ? lineItems : [{ ...EMPTY_LINE_ITEM }],
  };

  return { defaultValues };
}
