import type { PoListItem } from '@forethread/api-client';

type SortableField = keyof PoListItem;

export interface ColumnDef {
  field: SortableField;
  key: string;
}

/**
 * Full column catalogue for Procurement Officer & Company Admin.
 * Order = Figma US 2.07 "PO Management (All users)" table, followed by the
 * columns that exist in the catalogue but are hidden in the default view
 * (toggleable via Table settings). See PO_CA_DEFAULT_VISIBLE.
 */
export const PO_CA_COLUMNS: ColumnDef[] = [
  { field: 'poNumber', key: 'poNumber' },
  { field: 'projectName', key: 'projectName' },
  { field: 'projectId', key: 'projectId' },
  { field: 'vendorName', key: 'vendorName' },
  { field: 'status', key: 'poStatus' },
  { field: 'revision', key: 'revision' },
  { field: 'poType', key: 'poType' },
  { field: 'pickUp', key: 'pickUp' },
  { field: 'deliveryLocationName', key: 'deliveryLocationId' },
  { field: 'pickUpLocation', key: 'pickUpLocation' },
  { field: 'paymentTermsDays', key: 'paymentTermsDays' },
  { field: 'totalAmount', key: 'totalAmount' },
  { field: 'linkedRfqAvgPrice', key: 'linkedRfqAvgPrice' },
  { field: 'deadlineEnd', key: 'needBy' },
  { field: 'deadlineStart', key: 'earliestDate' },
  { field: 'lineItemCount', key: 'lineItems' },
  { field: 'lineItemsDelivered', key: 'lineItemsDelivered' },
  { field: 'totalRequestedQty', key: 'totalQuantity' },
  { field: 'quantityDelivered', key: 'quantityDelivered' },
  { field: 'createdDate', key: 'createdDate' },
  { field: 'createdBy', key: 'createdBy' },
  { field: 'lastModifiedBy', key: 'lastModifyBy' },
  { field: 'updatedAt', key: 'lastUpdated' },
  { field: 'updatedAt', key: 'aging' },
  /* Hidden by default — available via Table settings */
  { field: 'holdForRelease', key: 'holdForRelease' },
  { field: 'plannedDeliveryDate', key: 'plannedDeliveryDate' },
  { field: 'approvalStatus', key: 'approvalStatus' },
  { field: 'approvedBy', key: 'approvedBy' },
  { field: 'poType', key: 'isBulkOrder' },
];

/** Columns shown by default for PO/CA (Figma US 2.07 main table). */
export const PO_CA_DEFAULT_VISIBLE: string[] = [
  'poNumber',
  'projectName',
  'projectId',
  'vendorName',
  'poStatus',
  'revision',
  'poType',
  'pickUp',
  'deliveryLocationId',
  'pickUpLocation',
  'paymentTermsDays',
  'totalAmount',
  'linkedRfqAvgPrice',
  'needBy',
  'earliestDate',
  'lineItems',
  'lineItemsDelivered',
  'totalQuantity',
  'quantityDelivered',
  'createdDate',
  'createdBy',
  'lastModifyBy',
  'lastUpdated',
  'aging',
];

/**
 * Vendor column catalogue (createdBy, lastModifiedBy, approvalStatus, approvedBy
 * and linkedRfqAvgPrice are not exposed to vendors per spec).
 * Order = Figma US 2.07 "PO Management (Vendor)" table, followed by the
 * hidden-by-default columns. See VENDOR_DEFAULT_VISIBLE.
 */
export const VENDOR_COLUMNS: ColumnDef[] = [
  { field: 'poNumber', key: 'poNumber' },
  { field: 'projectName', key: 'projectName' },
  { field: 'projectId', key: 'projectId' },
  { field: 'contractorName', key: 'contractorName' },
  { field: 'status', key: 'poStatus' },
  { field: 'revision', key: 'revision' },
  { field: 'poType', key: 'poType' },
  { field: 'pickUp', key: 'pickUp' },
  { field: 'deliveryLocationName', key: 'deliveryLocationId' },
  { field: 'pickUpLocation', key: 'pickUpLocation' },
  { field: 'paymentTermsDays', key: 'paymentTermsDays' },
  { field: 'totalAmount', key: 'totalAmount' },
  { field: 'deadlineEnd', key: 'needBy' },
  { field: 'deadlineStart', key: 'earliestDate' },
  { field: 'lineItemCount', key: 'lineItems' },
  { field: 'lineItemsDelivered', key: 'lineItemsDelivered' },
  { field: 'totalRequestedQty', key: 'totalQuantity' },
  { field: 'quantityDelivered', key: 'quantityDelivered' },
  { field: 'createdDate', key: 'createdDate' },
  { field: 'updatedAt', key: 'lastUpdated' },
  { field: 'updatedAt', key: 'aging' },
  /* Hidden by default — available via Table settings */
  { field: 'holdForRelease', key: 'holdForRelease' },
  { field: 'plannedDeliveryDate', key: 'plannedDeliveryDate' },
  { field: 'poType', key: 'isBulkOrder' },
];

/** Columns shown by default for Vendors (Figma US 2.07 main table). */
export const VENDOR_DEFAULT_VISIBLE: string[] = [
  'poNumber',
  'projectName',
  'projectId',
  'contractorName',
  'poStatus',
  'revision',
  'poType',
  'pickUp',
  'deliveryLocationId',
  'pickUpLocation',
  'paymentTermsDays',
  'totalAmount',
  'needBy',
  'earliestDate',
  'lineItems',
  'lineItemsDelivered',
  'totalQuantity',
  'quantityDelivered',
  'createdDate',
  'lastUpdated',
  'aging',
];

export const TRUNCATE_COLUMNS = [
  'projectName',
  'vendorName',
  'contractorName',
  'deliveryLocationName',
  'pickUpLocation',
  'createdBy',
  'lastModifyBy',
  'approvedBy',
];
