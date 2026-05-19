import type { VendorActivePo } from '@forethread/api-client';

export interface ActivePosTableProps {
  items: VendorActivePo[];
  isLoading?: boolean;
}

export type SortableField = keyof VendorActivePo;

export interface ColumnConfig {
  key: string;
  field: SortableField;
  label: string;
  cell?: (row: VendorActivePo) => React.ReactNode;
}
