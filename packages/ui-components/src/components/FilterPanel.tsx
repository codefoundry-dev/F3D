import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import CrossIcon from '../assets/icons/cross.svg?react';
import FilterIcon from '../assets/icons/filter.svg?react';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { cn } from '../utils/cn';

export interface FilterPanelProps {
  /** Panel content (filter fields) */
  children: ReactNode;
  /** Button label */
  label?: string;
  /** Whether the panel is full width or fixed width */
  fullWidth?: boolean;
  /** Fixed width when not full-width (e.g. "600px") */
  width?: string;
  /** Title displayed inside the panel */
  title?: string;
  /** Clear all handler and label */
  onClearAll?: () => void;
  clearAllLabel?: string;
  /** External open state control */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function FilterPanel({
  children,
  label = 'Filters',
  fullWidth = true,
  width,
  title = 'Advanced Filters',
  onClearAll,
  clearAllLabel = 'Clear all',
  open: controlledOpen,
  onOpenChange,
  className,
}: FilterPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen = useCallback(
    (val: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof val === 'function' ? val(isOpen) : val;
      if (onOpenChange) {
        onOpenChange(next);
      } else {
        setInternalOpen(next);
      }
    },
    [isOpen, onOpenChange],
  );

  const isMobile = useMediaQuery('(max-width: 768px)');

  const close = useCallback(() => setIsOpen(false), [setIsOpen]);

  // Close on click outside (desktop only)
  useClickOutside(containerRef, close, isOpen && !isMobile);

  // Close on Escape
  useEscapeKey(close, isOpen);

  // When fullWidth, calculate position to span the page content area
  const panelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!isOpen || isMobile || !fullWidth || !panelRef.current || !containerRef.current) return;

    // Walk up to find the scrollable / page-level content container
    let ancestor: HTMLElement | null = containerRef.current.parentElement;
    while (ancestor && ancestor !== document.body) {
      const style = getComputedStyle(ancestor);
      const pl = parseFloat(style.paddingLeft);
      const pr = parseFloat(style.paddingRight);
      // The toolbar wrapper typically has significant horizontal padding (px-6 / px-8)
      if (pl >= 16 && pr >= 16) break;
      ancestor = ancestor.parentElement;
    }
    if (!ancestor || ancestor === document.body) return;

    const ancestorRect = ancestor.getBoundingClientRect();
    const ancestorStyle = getComputedStyle(ancestor);
    const paddingLeft = parseFloat(ancestorStyle.paddingLeft);
    const paddingRight = parseFloat(ancestorStyle.paddingRight);

    const containerRect = containerRef.current.getBoundingClientRect();

    // Align to the content area (inside padding) of the ancestor
    const contentLeft = ancestorRect.left + paddingLeft;
    const contentWidth = ancestorRect.width - paddingLeft - paddingRight;

    panelRef.current.style.left = `${contentLeft - containerRect.left}px`;
    panelRef.current.style.width = `${contentWidth}px`;
  }, [isOpen, isMobile, fullWidth]);

  const panelContent = (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {onClearAll && (
          <button
            type="button"
            onClick={onClearAll}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {clearAllLabel}
            <CrossIcon className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
    </>
  );

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium border border-foreground/20 text-foreground hover:bg-accent rounded-xl transition-colors"
      >
        {label}
        <FilterIcon className="w-4 h-4" />
      </button>

      {/* Desktop panel */}
      {isOpen && !isMobile && (
        <div
          ref={panelRef}
          className={cn(
            'mt-3 p-4 bg-card border border-border rounded-xl absolute z-40',
            !fullWidth && 'right-0',
          )}
          style={!fullWidth && width ? { width } : undefined}
        >
          {panelContent}
        </div>
      )}

      {/* Mobile full-screen modal */}
      {isOpen && isMobile && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={close}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
            }}
            role="presentation"
          />
          <div className="fixed inset-0 z-50 bg-card flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              <button
                type="button"
                onClick={close}
                className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
              >
                <CrossIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {onClearAll && (
                <div className="flex justify-end mb-4">
                  <button
                    type="button"
                    onClick={onClearAll}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {clearAllLabel}
                    <CrossIcon className="w-3 h-3" />
                  </button>
                </div>
              )}
              {children}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
