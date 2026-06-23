import type { BulkOrderListItem } from '@forethread/api-client';

export type SortableField = keyof BulkOrderListItem;

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export const COLUMNS: Array<{ field: SortableField; key: string }> = [
  { field: 'id', key: 'bulkOrderId' },
  { field: 'projectName', key: 'projectName' },
  { field: 'projectCode', key: 'projectCode' },
  { field: 'vendorName', key: 'vendorName' },
  { field: 'status', key: 'status' },
  { field: 'lineItems', key: 'lineItems' },
  { field: 'consumptionPercent', key: 'utilizationPercent' },
  { field: 'totalAmount', key: 'totalAmount' },
  { field: 'validUntil', key: 'validUntil' },
];
