import type { PoListItem } from '@forethread/api-client';

export type SortableField = keyof PoListItem;

export const PAGE_SIZE_OPTIONS = [10, 25, 50];

export const VENDOR_COLUMNS: Array<{ field: SortableField; key: string }> = [
  { field: 'poNumber', key: 'poNumber' },
  { field: 'projectName', key: 'projectName' },
  { field: 'projectId', key: 'projectId' },
  { field: 'contractorName', key: 'contractorName' },
  { field: 'status', key: 'poStatus' },
  { field: 'revision', key: 'revision' },
  { field: 'poType', key: 'poType' },
  { field: 'pickUp', key: 'pickUp' },
];
