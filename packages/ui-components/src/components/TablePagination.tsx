import { useMemo } from 'react';

import { cn } from '../utils/cn';

import { CustomDropdown } from './CustomDropdown';

export interface TablePaginationProps {
  page: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  rowsPerPageLabel?: string;
  showingLabel?: (params: { from: number; to: number; total: number }) => string;
  backLabel?: string;
  nextLabel?: string;
  className?: string;
}

function buildPageNumbers(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];
  pages.push(1, 2);

  if (page > 4) pages.push('ellipsis');

  const start = Math.max(3, page - 1);
  const end = Math.min(totalPages - 2, page + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (page < totalPages - 3) pages.push('ellipsis');

  pages.push(totalPages - 1, totalPages);

  const seen = new Set<number | 'ellipsis'>();
  return pages.filter((p) => {
    if (p === 'ellipsis') return true;
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
}

export function TablePagination({
  page,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 25, 50],
  onPageChange,
  onPageSizeChange,
  rowsPerPageLabel = 'Rows per page:',
  showingLabel,
  backLabel = 'Back',
  nextLabel = 'Next',
  className,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pageNumbers = useMemo(() => buildPageNumbers(page, totalPages), [page, totalPages]);

  // Hide pagination when all items fit on a single page
  if (totalItems <= pageSize) return null;

  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  const showingText = showingLabel
    ? showingLabel({ from, to, total: totalItems })
    : `Showing ${from} to ${to} of ${totalItems}`;

  return (
    <div
      className={cn('flex flex-wrap items-center justify-between gap-y-3 text-sm py-2', className)}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>{rowsPerPageLabel}</span>
        <CustomDropdown
          options={pageSizeOptions.map((size) => ({ value: String(size), label: String(size) }))}
          value={String(pageSize)}
          onChange={(val) => {
            onPageSizeChange?.(Number(val));
            onPageChange(1);
          }}
          className="w-[76px]"
        />
      </div>

      <span className="text-muted-foreground">{showingText}</span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 border border-input rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
        >
          {backLabel}
        </button>

        {pageNumbers.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground select-none">
              ...
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                'w-9 h-9 rounded-md text-sm font-medium transition-colors',
                page === p ? 'bg-foreground text-background' : 'hover:bg-accent text-foreground',
              )}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 border border-input rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
