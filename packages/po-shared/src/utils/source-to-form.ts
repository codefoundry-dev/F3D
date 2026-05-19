import type { RfqDetail, BulkOrderDetail } from '@forethread/api-client';

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
 * Convert a Bulk Order into form defaults + locked fields for the PO wizard.
 *
 * Locks: vendorId
 * (project is empty/editable, delivery location is empty/editable)
 */
export function bulkOrderToFormDefaults(bo: BulkOrderDetail): SourceFormDefaults {
  const lineItems: FormValues['lineItems'] = bo.lineItems.map((li) => ({
    ...EMPTY_LINE_ITEM,
    materialName: li.description || li.itemReference,
    materialCode: li.itemReference ?? '',
    unitOfMeasure: li.unit,
    unitPrice: li.pricePerUnit,
    quantityOrdered: li.qtyRemaining > 0 ? li.qtyRemaining : li.qty,
  }));

  const defaultValues: Partial<FormValues> = {
    documentName: bo.projectName ? `PO — ${bo.projectName}` : '',
    vendorId: '', // Will be resolved by matching vendorName in the page
    lineItems: lineItems.length > 0 ? lineItems : [{ ...EMPTY_LINE_ITEM }],
  };

  const lockedFields = new Set<LockedField>(['vendorId']);

  return { defaultValues, lockedFields };
}
