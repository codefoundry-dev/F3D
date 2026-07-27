import type { RfqDetail, BulkOrderDetail, PoDetail } from '@forethread/api-client';
import { PickUpTimeExpectation } from '@forethread/shared-types/client';

import type { FormValues, LockedField } from '../schemas/create-po.schema';
import { EMPTY_DELIVERY_ROW, EMPTY_LINE_ITEM } from '../schemas/create-po.schema';

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
    // Carry the RFQ line's catalogue link + code snapshots onto the PO line.
    materialId: li.materialId ?? '',
    costCode: li.costCode ?? '',
    upc: li.upc ?? '',
    manufacturerPartNumber: li.manufacturerPartNumber ?? '',
    taxCode: li.taxCode ?? '',
    description: li.description ?? '',
    unitOfMeasure: li.unit,
    quantityOrdered: li.quantity,
    expectedDeliveryDate: li.expectedDeliveryDate ?? '',
    deliveryTime: li.deliveryTime ?? '',
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
 * change mode. *Every* field the change form renders is pre-filled — PO-level
 * attributes, the header delivery schedule (FOR-210), and each line item, which
 * additionally carries its existing PO line `id` (as `lineItemId`) so the diff
 * can match edited rows against the original PO.
 *
 * Prefilling deliberately covers more than the change *diff* allowlist: a field
 * left blank here reads as "this PO has no value" and invites the user to refill
 * data that is actually already set, so the form must mirror the PO in full even
 * where an edit would not currently be submitted.
 *
 * Naming trap: `PoLineItemDetail.deliveryLocation` carries the location **id**,
 * not its name (the backend maps `deliveryLocation: li.deliveryLocationId`), so
 * it binds straight to the form's location dropdown.
 *
 * The document name is returned pre-filled; the wizard locks it in change mode.
 */
export function poToFormDefaults(po: PoDetail): { defaultValues: Partial<FormValues> } {
  const lineItems: FormValues['lineItems'] = po.lineItems.map((li) => ({
    ...EMPTY_LINE_ITEM,
    lineItemId: li.id,
    materialName: li.materialName ?? li.description ?? '',
    materialId: li.materialId ?? '',
    materialCode: li.materialCode ?? '',
    costCode: li.costCode ?? '',
    // Keep the line's catalogue snapshots across a change — otherwise the
    // replacement PO would silently drop UPC / MPN / tax code.
    upc: li.upc ?? '',
    manufacturerPartNumber: li.manufacturerPartNumber ?? '',
    taxCode: li.taxCode ?? '',
    unitOfMeasure: li.unitOfMeasure,
    unitPrice: li.unitPrice,
    quantityOrdered: li.quantityOrdered,
    expectedDeliveryDate: li.expectedDeliveryDate ? li.expectedDeliveryDate.slice(0, 10) : '',
    deliveryTime: li.deliveryTime ?? '',
    deliveryLocationId: li.deliveryLocation ?? '',
    description: li.description ?? '',
    notes: li.notes ?? '',
  }));

  // FOR-210 header delivery schedule. A PO with no rows still gets one blank
  // card so the section renders its "Delivery 1" placeholder as in create mode.
  const deliveries: NonNullable<FormValues['deliveries']> = (po.deliveries ?? []).map((d) => ({
    deliveryLocationId: d.deliveryLocationId ?? '',
    deliveryDate: d.deliveryDate ? d.deliveryDate.slice(0, 10) : '',
    notes: d.notes ?? '',
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
    deliveries: deliveries.length > 0 ? deliveries : [{ ...EMPTY_DELIVERY_ROW }],
  };

  return { defaultValues };
}
