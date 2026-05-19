import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ChevronDownIcon from '../assets/icons/chevron-down.svg?react';
import SearchIcon from '../assets/icons/search.svg?react';
import { cn } from '../utils/cn';

import { Checkbox } from './Checkbox';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterPopoverProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
  /** Title displayed inside the popover header */
  popoverTitle?: string;
  /** Label for the clear button */
  clearLabel?: string;
  /** Enable search input inside the popover */
  searchable?: boolean;
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
}

export function FilterPopover({
  label,
  options,
  selected,
  onChange,
  className,
  popoverTitle,
  clearLabel = 'Clear',
  searchable = false,
  searchPlaceholder = 'Search',
}: FilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  // Close on click outside (desktop)
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus({ preventScroll: true });
    }
  }, [isOpen, searchable]);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleClear = () => {
    onChange([]);
    setSearchQuery('');
  };

  const activeCount = selected.length;

  const filteredOptions = useMemo(
    () =>
      searchable && searchQuery
        ? options.filter((o) => o.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : options,
    [options, searchable, searchQuery],
  );

  const popoverHeader =
    (popoverTitle ?? searchable) ? (
      <div className="px-4 pt-3 pb-2">
        {popoverTitle && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-foreground">{popoverTitle}</span>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {clearLabel}
              </button>
            )}
          </div>
        )}
        {searchable && (
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50 focus:bg-muted"
            />
          </div>
        )}
      </div>
    ) : null;

  const optionsList = (
    <div className="py-1 max-h-52 overflow-auto">
      {filteredOptions.map((option, index) => (
        <div key={`${option.value}-${index}`} className="px-4 py-1.5">
          <Checkbox
            checked={selected.includes(option.value)}
            onChange={() => toggleOption(option.value)}
            label={option.label}
          />
        </div>
      ))}
      {searchable && filteredOptions.length === 0 && (
        <div className="px-4 py-2 text-sm text-muted-foreground">No results found</div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors',
          activeCount > 0
            ? 'border-foreground/30 text-foreground bg-accent'
            : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
        )}
      >
        {label}
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-foreground text-background">
            {activeCount}
          </span>
        )}
        {/* Chevron */}
        <ChevronDownIcon
          className={cn(
            'w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Desktop dropdown */}
      {isOpen && !isMobile && (
        <div className="absolute left-0 mt-1 w-64 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden">
          {popoverHeader}
          {optionsList}
        </div>
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
            <div className="px-4 py-2 text-sm font-medium text-foreground border-b border-border flex items-center justify-between">
              <span>{popoverTitle ?? label}</span>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {clearLabel}
                </button>
              )}
            </div>
            {searchable && (
              <div className="px-4 pt-3">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50 focus:bg-muted"
                  />
                </div>
              </div>
            )}
            {optionsList}
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
