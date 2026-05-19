import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import ChevronDownIcon from '../assets/icons/chevron-down.svg?react';
import { cn } from '../utils/cn';

import { DatePicker } from './DatePicker';

export interface DateRangeFilterDropdownProps {
  /** Text displayed on the trigger button (e.g. "Date") */
  label: string;
  /** Start date value in YYYY-MM-DD format */
  dateFrom: string;
  /** End date value in YYYY-MM-DD format */
  dateTo: string;
  /** Called when start date changes */
  onChangeFrom: (date: string) => void;
  /** Called when end date changes */
  onChangeTo: (date: string) => void;
  /** Called when the Clear button is pressed */
  onClear: () => void;
  /** Label for the clear button */
  clearLabel?: string;
  /** Placeholder for the "from" date picker */
  fromPlaceholder?: string;
  /** Placeholder for the "to" date picker */
  toPlaceholder?: string;
  /** Additional class for the root container */
  className?: string;
  /** Additional class for the trigger button */
  buttonClassName?: string;
  /** Disable the dropdown */
  disabled?: boolean;
}

export function DateRangeFilterDropdown({
  label,
  dateFrom,
  dateTo,
  onChangeFrom,
  onChangeTo,
  onClear,
  clearLabel = 'Clear',
  fromPlaceholder = 'From',
  toPlaceholder = 'To',
  className,
  buttonClassName,
  disabled,
}: DateRangeFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Detect mobile
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Position the portal dropdown relative to the trigger button
  useLayoutEffect(() => {
    if (!isOpen || isMobile || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 200;
    setPopoverStyle({
      position: 'fixed',
      left: rect.left,
      width: 340,
      ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  }, [isOpen, isMobile]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close on click outside — check trigger, portal, and any nested portals (e.g. DatePicker calendar)
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !popoverRef.current?.contains(target) &&
        !(target instanceof Element && target.closest('[data-datepicker-portal]'))
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, isMobile, close]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  const hasValue = Boolean(dateFrom || dateTo);
  const displayLabel = hasValue ? `${label} (1)` : label;

  const content = (
    <>
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground leading-[140%] truncate">
            {label}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-muted-foreground leading-[140%] hover:text-foreground transition-colors flex-shrink-0 ml-2"
          >
            {clearLabel}
          </button>
        </div>
      </div>
      <div className="px-4 pb-3 flex items-center gap-2">
        <DatePicker
          value={dateFrom}
          onChange={onChangeFrom}
          placeholder={fromPlaceholder}
          maxDate={dateTo || undefined}
          className="flex-1"
        />
        <span className="text-muted-foreground text-sm flex-shrink-0">-</span>
        <DatePicker
          value={dateTo}
          onChange={onChangeTo}
          placeholder={toPlaceholder}
          minDate={dateFrom || undefined}
          className="flex-1"
        />
      </div>
    </>
  );

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center border bg-background rounded-lg py-2.5 px-3 text-sm transition-colors',
          'focus:outline-none focus:border-foreground/50 focus:bg-muted',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          hasValue ? 'border-foreground/50' : 'border-input',
          isOpen && 'border-foreground/50',
          buttonClassName,
        )}
        aria-expanded={isOpen}
      >
        <span className="flex-1 text-left truncate text-foreground">{displayLabel}</span>
        <ChevronDownIcon
          className={cn(
            'w-4 h-4 ml-2 text-muted-foreground transition-transform flex-shrink-0',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Desktop popover (portal) */}
      {isOpen &&
        !isMobile &&
        createPortal(
          <div
            ref={popoverRef}
            style={popoverStyle}
            className="bg-card border border-border rounded-xl shadow-lg z-[9999]"
          >
            {content}
          </div>,
          document.body,
        )}

      {/* Mobile bottom sheet */}
      {isOpen && isMobile && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
            }}
            role="presentation"
          />
          <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl z-50 pb-safe">
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-2" />
            {content}
            <div className="px-4 pb-4 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  close();
                }}
                className="w-full py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
