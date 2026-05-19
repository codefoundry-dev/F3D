export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  pageLabel,
  previousLabel = 'Previous',
  nextLabel = 'Next',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{pageLabel ?? `Page ${page} of ${totalPages}`}</span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 border border-input rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {previousLabel}
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 border border-input rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
