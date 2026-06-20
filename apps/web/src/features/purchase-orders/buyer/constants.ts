import type { PoListItem } from '@forethread/api-client';

export type SortableField = keyof PoListItem;

export const PAGE_SIZE_OPTIONS = [10, 25, 50];

export const PO_QUICK_FILTERS = [
  'allOpen',
  'pendingIntApproval',
  'pendingExtApproval',
  'approvedByVendor',
  'partiallyDelivered',
  'closed',
  'dueSoon',
  'openRevision',
  'withUnreadMessages',
  'recentlyUpdated',
] as const;

export const GROUP_OPTIONS = ['groupByProject', 'groupByStatus'] as const;

export const PO_COLUMNS: Array<{ field: SortableField; key: string }> = [
  { field: 'poNumber', key: 'poNumber' },
  { field: 'projectName', key: 'projectName' },
  // "Project ID" column shows the human-readable code (PRJ-YYYY-NNN) to match
  // the Projects table; the key stays `projectId` (label/visibility/export).
  { field: 'projectCode', key: 'projectId' },
  { field: 'contractorName', key: 'vendorName' },
  { field: 'status', key: 'poStatus' },
  { field: 'revision', key: 'revision' },
  { field: 'poType', key: 'poType' },
  { field: 'pickUp', key: 'pickUp' },
  { field: 'deliveryLocationId', key: 'deliveryLocationId' },
];

export const TRUNCATE_COLUMNS = ['projectName', 'vendorName', 'deliveryLocationId'];
