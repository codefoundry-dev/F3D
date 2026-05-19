import type { ReactNode } from 'react';

import { cn } from '../../utils/cn';
import { Checkbox } from '../Checkbox';
import { EmptyState } from '../EmptyState';
import { SortIcon } from '../SortIcon';

import { DataTableActions, type RowAction } from './DataTableActions';
import { DataTablePagination } from './DataTablePagination';
import { DataTableQuickFilters, type QuickFilterOption } from './DataTableQuickFilters';
import { DataTableSearch } from './DataTableSearch';

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessor: keyof T | ((row: T) => ReactNode);
  sortable?: boolean;
  width?: string;
  cell?: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  // Pagination
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  // Sorting
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (columnId: string) => void;
  // Search (optional)
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  // Quick filters (optional)
  quickFilters?: QuickFilterOption[];
  activeFilter?: string;
  onFilterChange?: (value: string) => void;
  // Row actions (optional)
  rowActions?: RowAction<T>[];
  // Checkbox selection (optional)
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  getRowId?: (row: T) => string;
  // State
  loading?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  className?: string;
}

function getCellValue<T>(row: T, column: ColumnDef<T>): ReactNode {
  if (column.cell) {
    return column.cell(row);
  }
  if (typeof column.accessor === 'function') {
    return column.accessor(row);
  }
  const value = row[column.accessor];
  return value as ReactNode;
}

function SkeletonRow({ colCount }: { colCount: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: colCount }, (_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-muted animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T>({
  columns,
  data,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  sortBy,
  sortDir,
  onSort,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  quickFilters,
  activeFilter,
  onFilterChange,
  rowActions,
  selectable,
  selectedIds = [],
  onSelectionChange,
  getRowId,
  loading = false,
  emptyMessage = 'No data found',
  emptyDescription,
  className,
}: DataTableProps<T>) {
  const hasToolbar =
    onSearchChange !== undefined || (quickFilters !== undefined && quickFilters.length > 0);

  const totalColCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

  const allRowIds = getRowId ? data.map(getRowId) : [];
  const allSelected =
    selectable && allRowIds.length > 0 && allRowIds.every((id) => selectedIds.includes(id));
  const someSelected =
    selectable && !allSelected && allRowIds.some((id) => selectedIds.includes(id));

  const handleSelectAll = () => {
    if (!onSelectionChange || !getRowId) return;
    if (allSelected) {
      // Deselect all on current page
      onSelectionChange(selectedIds.filter((id) => !allRowIds.includes(id)));
    } else {
      // Select all on current page
      const newIds = new Set([...selectedIds, ...allRowIds]);
      onSelectionChange(Array.from(newIds));
    }
  };

  const handleSelectRow = (rowId: string) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(rowId)) {
      onSelectionChange(selectedIds.filter((id) => id !== rowId));
    } else {
      onSelectionChange([...selectedIds, rowId]);
    }
  };

  return (
    <div className={cn('flex flex-col rounded-xl border border-border bg-card', className)}>
      {/* Toolbar: search + quick filters */}
      {hasToolbar && (
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            {onSearchChange !== undefined && (
              <DataTableSearch
                value={searchValue ?? ''}
                onChange={onSearchChange}
                placeholder={searchPlaceholder}
                className="w-64"
              />
            )}
          </div>
          {quickFilters && quickFilters.length > 0 && onFilterChange && (
            <DataTableQuickFilters
              filters={quickFilters}
              activeFilter={activeFilter}
              onFilterChange={onFilterChange}
            />
          )}
        </div>
      )}

      {/* Empty state — no table at all */}
      {!loading && data.length === 0 && (
        <EmptyState title={emptyMessage} description={emptyDescription} />
      )}

      {/* Table — only when loading or has data */}
      {(loading || data.length > 0) && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {selectable && (
                  <th className="w-12 px-4 py-3">
                    <Checkbox
                      checked={allSelected === true}
                      onChange={handleSelectAll}
                      className={someSelected ? 'opacity-70' : undefined}
                    />
                  </th>
                )}
                {columns.map((column) => {
                  const isSorted = sortBy === column.id;
                  return (
                    <th
                      key={column.id}
                      className={cn(
                        'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground',
                        column.sortable && 'cursor-pointer select-none',
                      )}
                      style={column.width ? { width: column.width } : undefined}
                      onClick={column.sortable && onSort ? () => onSort(column.id) : undefined}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {column.header}
                        {column.sortable && (
                          <SortIcon
                            active={isSorted}
                            direction={isSorted ? (sortDir ?? null) : null}
                          />
                        )}
                      </span>
                    </th>
                  );
                })}
                {rowActions && rowActions.length > 0 && (
                  <th className="w-24 px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: pageSize > 5 ? 5 : pageSize }, (_, i) => (
                  <SkeletonRow key={i} colCount={totalColCount} />
                ))}

              {!loading &&
                data.map((row, rowIndex) => {
                  const rowId = getRowId ? getRowId(row) : String(rowIndex);
                  const isSelected = selectable && selectedIds.includes(rowId);
                  return (
                    <tr
                      key={rowId}
                      className={cn(
                        'border-b border-border transition-colors hover:bg-muted/30',
                        isSelected && 'bg-accent/50',
                      )}
                    >
                      {selectable && (
                        <td className="w-12 px-4 py-3">
                          <Checkbox
                            checked={isSelected === true}
                            onChange={() => handleSelectRow(rowId)}
                          />
                        </td>
                      )}
                      {columns.map((column) => (
                        <td key={column.id} className="px-4 py-3 text-foreground">
                          {getCellValue(row, column)}
                        </td>
                      ))}
                      {rowActions && rowActions.length > 0 && (
                        <td className="px-4 py-3 text-right">
                          <DataTableActions
                            row={row}
                            actions={rowActions}
                            className="justify-end"
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination footer — hidden when no data */}
      {totalCount > 0 && (
        <DataTablePagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}
