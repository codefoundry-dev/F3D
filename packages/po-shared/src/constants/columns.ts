import type { PoListItem } from '@forethread/api-client';

type SortableField = keyof PoListItem;

export interface ColumnDef {
  field: SortableField;
  key: string;
}

/** Full column set for Procurement Officer & Company Admin (spec US-2.07 AC 25) */
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
  { field: 'deadlineEnd', key: 'needBy' },
  { field: 'holdForRelease', key: 'holdForRelease' },
  { field: 'deadlineStart', key: 'earliestDate' },
  { field: 'plannedDeliveryDate', key: 'plannedDeliveryDate' },
  { field: 'lineItemCount', key: 'lineItems' },
  { field: 'totalRequestedQty', key: 'totalQuantity' },
  { field: 'createdDate', key: 'createdDate' },
  { field: 'createdBy', key: 'createdBy' },
  { field: 'lastModifiedBy', key: 'lastModifyBy' },
  { field: 'updatedAt', key: 'lastUpdated' },
  { field: 'approvalStatus', key: 'approvalStatus' },
  { field: 'approvedBy', key: 'approvedBy' },
  { field: 'updatedAt', key: 'aging' },
  { field: 'poType', key: 'isBulkOrder' },
  { field: 'linkedRfqAvgPrice', key: 'linkedRfqAvgPrice' },
  { field: 'lineItemsDelivered', key: 'lineItemsDelivered' },
  { field: 'quantityDelivered', key: 'quantityDelivered' },
];

/** Vendor-specific columns (createdBy, lastModifiedBy, approvalStatus, approvedBy not visible per spec) */
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
  { field: 'holdForRelease', key: 'holdForRelease' },
  { field: 'deadlineStart', key: 'earliestDate' },
  { field: 'plannedDeliveryDate', key: 'plannedDeliveryDate' },
  { field: 'lineItemCount', key: 'lineItems' },
  { field: 'totalRequestedQty', key: 'totalQuantity' },
  { field: 'updatedAt', key: 'lastUpdated' },
  { field: 'updatedAt', key: 'aging' },
  { field: 'poType', key: 'isBulkOrder' },
  { field: 'lineItemsDelivered', key: 'lineItemsDelivered' },
  { field: 'quantityDelivered', key: 'quantityDelivered' },
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
