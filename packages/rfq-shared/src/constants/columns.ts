import type { RfqListItem } from '@forethread/api-client';

type SortableField = keyof RfqListItem;

export interface ColumnDef {
  field: SortableField;
  key: string;
}

/**
 * Full column set for Procurement Officer & Company Admin.
 * Order + keys mirror the US 2.06 "RFQ dashboard (PO + CA)" Figma design,
 * left→right. The `key`s are also the values sent to the export endpoint
 * (`columns` param) so they MUST stay stable across this list, the i18n
 * `columns.*` labels, and the table-management modal options.
 */
export const PO_CA_COLUMNS: ColumnDef[] = [
  { field: 'rfqNumber', key: 'rfqId' },
  { field: 'projectName', key: 'projectName' },
  { field: 'projectId', key: 'projectId' },
  { field: 'status', key: 'rfqStatus' },
  { field: 'deadlineRange', key: 'resDeadline' },
  { field: 'pickUp', key: 'pickUp' },
  { field: 'deliveryLocation', key: 'deliveryLocation' },
  { field: 'pickUpLocation', key: 'pickUpLocation' },
  { field: 'invitedVendors', key: 'invitedVendors' },
  { field: 'recQuotes', key: 'recQuotes' },
  { field: 'applVendors', key: 'applVendors' },
  { field: 'lineItems', key: 'lineItems' },
  { field: 'declinedItems', key: 'declinedItems' },
  { field: 'approvedItems', key: 'approvedItems' },
  { field: 'totalRequestedQty', key: 'totalRequestedQty' },
  { field: 'avgQuoteCost', key: 'avgQuoteCost' },
  { field: 'createdDate', key: 'createdDate' },
  { field: 'createdBy', key: 'createdBy' },
  { field: 'approvalStatus', key: 'approvalStatus' },
  { field: 'approvedBy', key: 'approvedBy' },
  { field: 'lastModifiedBy', key: 'lastModifiedBy' },
];

/**
 * Vendor dashboard columns. Order + short labels mirror the US 2.06
 * "RFQ dashboard (Vendor)" Figma table header (node 2934:13774), left→right.
 *
 * Field-mapping notes (no vendor-only DTO fields exist on `RfqListItem`):
 *  - `contractorCompany` + `contractorName` both resolve to `createdBy` — the
 *    DTO has a single contractor identity, not a separate org/person split.
 *  - `totalRespondedQuotes` maps to `recQuotes` (received quotes) — the closest
 *    real metric; there is no distinct "responded quotes" count.
 *
 * Keys MUST stay stable across this list, the i18n `columns.*` / `columnLabels.*`
 * labels, and the export `columns` param (rfq-export.service COLUMN_MAP).
 */
export const VENDOR_COLUMNS: ColumnDef[] = [
  { field: 'rfqNumber', key: 'rfqId' },
  { field: 'projectName', key: 'projectName' },
  { field: 'createdBy', key: 'contractorCompany' },
  { field: 'createdBy', key: 'contractorName' },
  { field: 'status', key: 'rfqStatus' },
  { field: 'deadlineRange', key: 'resDeadline' },
  { field: 'pickUp', key: 'pickUp' },
  { field: 'deliveryLocation', key: 'deliveryLocation' },
  { field: 'pickUpLocation', key: 'pickUpLocation' },
  { field: 'lineItems', key: 'lineItems' },
  { field: 'recQuotes', key: 'totalRespondedQuotes' },
];
