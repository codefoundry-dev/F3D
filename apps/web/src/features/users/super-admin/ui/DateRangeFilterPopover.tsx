import { cn, DatePicker } from '@forethread/ui-components';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface DateRangeFilterPopoverProps {
  /** Text shown on the trigger pill (e.g. "Date") */
  label: string;
  /** Title rendered inside the popover header */
  popoverTitle: string;
  /** Start date in YYYY-MM-DD format */
  dateFrom: string;
  /** End date in YYYY-MM-DD format */
  dateTo: string;
  /** Called when the start date changes */
  onChangeFrom: (date: string) => void;
  /** Called when the end date changes */
  onChangeTo: (date: string) => void;
  /** Called when the Clear button is pressed (should empty both dates) */
  onClear: () => void;
  /** Label for the clear button */
  clearLabel?: string;
  /** Placeholder for the "from" date picker */
  fromPlaceholder?: string;
  /** Placeholder for the "to" date picker */
  toPlaceholder?: string;
  className?: string;
}

/**
 * Date-range filter styled to match {@link FilterPopover}'s trigger pill (label +
 * chevron + active state), but instead of a checkbox list it opens a popover with
 * a "From – To" pair of {@link DatePicker}s. Mirrors the Figma "Date" filter.
 */
export function DateRangeFilterPopover({
  label,
  popoverTitle,
  dateFrom,
  dateTo,
  onChangeFrom,
  onChangeTo,
  onClear,
  clearLabel = 'Clear',
  fromPlaceholder = 'From',
  toPlaceholder = 'To',
  className,
}: DateRangeFilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);

  const hasValue = Boolean(dateFrom || dateTo);

  // Close on click outside — allow clicks inside the trigger/popover and the
  // DatePicker's portalled calendar (rendered to document.body).
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !(target instanceof Element && target.closest('[data-datepicker-portal]'))
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, close]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger pill — matches FilterPopover */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors',
          hasValue
            ? 'border-foreground/30 text-foreground bg-accent'
            : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
        )}
        aria-expanded={isOpen}
      >
        {label}
        {hasValue && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-foreground text-background">
            1
          </span>
        )}
        <ChevronDownIcon
          className={cn(
            'w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Desktop dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-1 w-80 bg-card border border-border rounded-xl shadow-lg z-20">
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground">{popoverTitle}</span>
              {hasValue && (
                <button
                  type="button"
                  onClick={onClear}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {clearLabel}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <DatePicker
                value={dateFrom}
                onChange={onChangeFrom}
                placeholder={fromPlaceholder}
                maxDate={dateTo || undefined}
                className="flex-1"
              />
              <span className="flex-shrink-0 text-sm text-muted-foreground">-</span>
              <DatePicker
                value={dateTo}
                onChange={onChangeTo}
                placeholder={toPlaceholder}
                minDate={dateFrom || undefined}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
