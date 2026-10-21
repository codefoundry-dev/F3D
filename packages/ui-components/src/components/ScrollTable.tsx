import { useRef, type ReactNode } from 'react';

import { useScrollEdges } from '../hooks/useScrollEdges';
import { cn } from '../utils/cn';

export interface ScrollTableProps {
  /** The `<table>` (its direct child). */
  children: ReactNode;
  /** Classes for the scroll box itself — border, radius, background, padding. */
  className?: string;
  /** Classes for the outer wrapper — margins, display/breakpoint, flex-item sizing. */
  wrapperClassName?: string;
  /**
   * 1-based column kept pinned to the left edge while the table scrolls, so
   * each row stays identifiable (ADR-0019 / FOR-371). Use 2 when column 1 is
   * a checkbox / star / drag handle; `false` for tables too narrow to scroll.
   */
  pinColumn?: 1 | 2 | 3 | false;
}

/**
 * ScrollTable — the shared wrapper for every read-only table.
 *
 * The table scrolls sideways inside its card (never the page), one column stays
 * pinned (`position: sticky`; styles in apps/web globals.css under
 * `[data-scroll-table]`), and an edge fade marks whichever side still has
 * columns out of view — on phones a table otherwise looks like it only has the
 * 2 columns that fit. Desktop gets the same behaviour (this is FOR-360).
 */
export function ScrollTable({
  children,
  className,
  wrapperClassName,
  pinColumn = 1,
}: ScrollTableProps) {
  const ref = useRef<HTMLDivElement>(null);
  const edges = useScrollEdges(ref);

  return (
    <div className={cn('relative', wrapperClassName)}>
      <div
        ref={ref}
        data-scroll-table=""
        data-pin={pinColumn || undefined}
        data-scrolled={edges.left || undefined}
        className={cn('overflow-x-auto', className)}
      >
        {children}
      </div>
      {edges.left && (
        <span
          aria-hidden
          data-testid="table-fade-left"
          className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/[0.06] to-transparent"
        />
      )}
      {edges.right && (
        <span
          aria-hidden
          data-testid="table-fade-right"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent"
        />
      )}
    </div>
  );
}
