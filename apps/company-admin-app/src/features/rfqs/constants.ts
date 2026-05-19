import type { RfqListItem } from '@forethread/api-client';
import { PO_CA_COLUMNS } from '@forethread/rfq-shared';

export type SortableField = keyof RfqListItem;

export const ALL_COLUMNS = PO_CA_COLUMNS;

export const DEFAULT_VISIBLE = ALL_COLUMNS.map((c) => c.key);

export const TRUNCATE_COLUMNS = ['projectName', 'deliveryLocation', 'pickUpLocation'];
