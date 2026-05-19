import type { BulkOrderListItem } from '@forethread/api-client';

export type SortableField = keyof BulkOrderListItem;

export const PAGE_SIZE_OPTIONS = [10, 25, 50];

export const COLUMNS: Array<{ field: SortableField; key: string }> = [
  { field: 'id', key: 'bulkOrderId' },
  { field: 'projectName', key: 'projectName' },
  { field: 'projectId', key: 'projectId' },
  { field: 'vendorName', key: 'vendorName' },
  { field: 'status', key: 'status' },
  { field: 'lineItems', key: 'lineItems' },
  { field: 'deliveriesPercent', key: 'utilizationPercent' },
  { field: 'totalAmount', key: 'totalAmount' },
  { field: 'validUntil', key: 'validUntil' },
];
