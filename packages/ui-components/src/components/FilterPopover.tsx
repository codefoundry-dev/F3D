import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ChevronDownIcon from '../assets/icons/chevron-down.svg?react';
import SearchIcon from '../assets/icons/search.svg?react';
import { cn } from '../utils/cn';

import { buttonVariants } from './Button';
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
            <span className="text-sm font-semibold text-gray-900">{popoverTitle}</span>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                {clearLabel}
              </button>
            )}
          </div>
        )}
        {searchable && (
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-9 rounded-[10px] border border-gray-100 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-[0_1px_2px_0_rgba(10,13,18,0.04)] focus:outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-100"
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
        <div className="px-4 py-2 text-sm text-gray-500">No results found</div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger button — DS secondary pill (gradient white + border + shadow) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          buttonVariants({ variant: 'secondary', size: 'md' }),
          'gap-2',
          isOpen && 'border-gray-300',
        )}
      >
        {/* Active count shown inline as "Label (N)" per the DS spec */}
        {activeCount > 0 ? `${label} (${activeCount})` : label}
        {/* Chevron */}
        <ChevronDownIcon
          className={cn(
            'w-4 h-4 text-gray-500 transition-transform flex-shrink-0',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Desktop dropdown */}
      {isOpen && !isMobile && (
        <div className="absolute left-0 mt-1 w-64 bg-white border border-gray-100 rounded-[12px] shadow-lg z-20 overflow-hidden">
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
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 pb-safe">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-2" />
            <div className="px-4 py-2 text-sm font-semibold text-gray-900 border-b border-gray-100 flex items-center justify-between">
              <span>{popoverTitle ?? label}</span>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                >
                  {clearLabel}
                </button>
              )}
            </div>
            {searchable && (
              <div className="px-4 pt-3">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full h-9 rounded-[10px] border border-gray-100 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-[0_1px_2px_0_rgba(10,13,18,0.04)] focus:outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-100"
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
                className="w-full py-2.5 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-100 rounded-xl"
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
