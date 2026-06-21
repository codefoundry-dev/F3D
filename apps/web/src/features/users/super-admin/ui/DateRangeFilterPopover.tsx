import { cn, buttonVariants, DatePicker } from '@forethread/ui-components';
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
          buttonVariants({ variant: 'secondary', size: 'md' }),
          'gap-2',
          hasValue && 'border-gray-300',
        )}
        aria-expanded={isOpen}
      >
        {label}
        {hasValue && (
          <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gray-900 px-1 text-[11px] font-semibold leading-none text-white">
            1
          </span>
        )}
        <ChevronDownIcon
          className={cn(
            'w-4 h-4 text-gray-500 transition-transform flex-shrink-0',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Desktop dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-1 w-80 bg-white border border-gray-100 rounded-[12px] shadow-lg z-20">
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-900">{popoverTitle}</span>
              {hasValue && (
                <button
                  type="button"
                  onClick={onClear}
                  className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
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
              <span className="flex-shrink-0 text-sm text-gray-400">-</span>
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
