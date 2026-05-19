import type { RfqListItem } from '@forethread/api-client';

type SortableField = keyof RfqListItem;

export interface ColumnDef {
  field: SortableField;
  key: string;
}

/** Full column set for Procurement Officer & Company Admin */
export const PO_CA_COLUMNS: ColumnDef[] = [
  { field: 'rfqNumber', key: 'rfqId' },
  { field: 'projectName', key: 'projectName' },
  { field: 'projectId', key: 'projectId' },
  { field: 'status', key: 'rfqStatus' },
  { field: 'deadlineRange', key: 'resDeadline' },
  { field: 'pickUp', key: 'pickUp' },
  { field: 'deliveryLocation', key: 'deliveryLocation' },
  { field: 'pickUpLocation', key: 'pickUpLocation' },
  { field: 'recVendors', key: 'recVendors' },
  { field: 'recQuotes', key: 'recQuotes' },
  { field: 'applVendors', key: 'applVendors' },
  { field: 'lineItems', key: 'lineItems' },
  { field: 'totalRequestedQty', key: 'totalRequestedQty' },
  { field: 'applIssues', key: 'applIssues' },
  { field: 'arcBlocksDist', key: 'arcBlocksDist' },
  { field: 'createdDate', key: 'createdDate' },
  { field: 'createdBy', key: 'createdBy' },
  { field: 'approvalStatus', key: 'approvalStatus' },
  { field: 'approvedBy', key: 'approvedBy' },
  { field: 'lastModifiedBy', key: 'lastModifiedBy' },
];

/** Vendor-specific columns (per Figma vendor view — 8 columns) */
export const VENDOR_COLUMNS: ColumnDef[] = [
  { field: 'rfqNumber', key: 'rfqId' },
  { field: 'createdBy', key: 'contractorName' },
  { field: 'deliveryLocation', key: 'deliveryLocation' },
  { field: 'status', key: 'rfqStatus' },
  { field: 'projectName', key: 'projectName' },
  { field: 'deadlineRange', key: 'resDeadline' },
  { field: 'lineItems', key: 'lineItems' },
  { field: 'totalRequestedQty', key: 'totalRequestedQty' },
];
