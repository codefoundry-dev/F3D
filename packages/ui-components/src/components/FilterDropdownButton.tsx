import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import ChevronDownIcon from '../assets/icons/chevron-down.svg?react';
import SearchIcon from '../assets/icons/search.svg?react';
import { cn } from '../utils/cn';

import { buttonVariants } from './Button';
import { Checkbox } from './Checkbox';

export interface FilterDropdownOption {
  value: string;
  label: string;
}

export interface FilterDropdownButtonProps {
  /** Text displayed on the trigger button (e.g. "All vendors", "All projects") */
  label: string;
  /** Title shown inside the popover header (e.g. "Vendors", "Project") */
  popoverTitle: string;
  /** Available options to select from */
  options: FilterDropdownOption[];
  /** Currently selected option values */
  selected: string[];
  /** Callback when selection changes */
  onChange: (selected: string[]) => void;
  /** Placeholder for the search input */
  searchPlaceholder?: string;
  /** Label for the clear button */
  clearLabel?: string;
  /** Label for the done button (mobile) */
  doneLabel?: string;
  /** Additional class for the root container */
  className?: string;
  /** Additional class for the trigger button */
  buttonClassName?: string;
  /** Disable the dropdown */
  disabled?: boolean;
  /** Hide the search input inside the popover */
  hideSearch?: boolean;
}

export function FilterDropdownButton({
  label,
  popoverTitle,
  options,
  selected,
  onChange,
  searchPlaceholder = 'Search',
  clearLabel = 'Clear',
  doneLabel = 'Done',
  className,
  buttonClassName,
  disabled,
  hideSearch,
}: FilterDropdownButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    const openUp = spaceBelow < 320;
    setPopoverStyle({
      position: 'fixed',
      left: rect.left,
      width: 320,
      ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  }, [isOpen, isMobile]);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  // Close on click outside (desktop only) — check both trigger and portal
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !popoverRef.current?.contains(target)
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

  // Focus search input when popover opens (desktop)
  useEffect(() => {
    if (isOpen && !isMobile && searchInputRef.current) {
      searchInputRef.current.focus({ preventScroll: true });
    }
  }, [isOpen, isMobile]);

  const filteredOptions = useMemo(
    () =>
      searchQuery
        ? options.filter((o) => o.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : options,
    [options, searchQuery],
  );

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
  const displayLabel = activeCount > 0 ? `${label} (${activeCount})` : label;

  const searchInput = (
    <div className="relative">
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
      <input
        ref={isMobile ? undefined : searchInputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={searchPlaceholder}
        className="w-full h-9 rounded-[10px] border border-gray-100 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-[0_1px_2px_0_rgba(10,13,18,0.04)] focus:outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-100"
      />
    </div>
  );

  const optionsList = (
    <>
      {filteredOptions.map((option) => (
        <div key={option.value} className="px-4 py-1.5">
          <Checkbox
            checked={selected.includes(option.value)}
            onChange={() => toggleOption(option.value)}
            label={option.label}
          />
        </div>
      ))}
      {filteredOptions.length === 0 && (
        <div className="px-4 py-2 text-sm text-gray-500">No results found</div>
      )}
    </>
  );

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger — DS secondary pill (gradient white + border + shadow), select-like layout */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          buttonVariants({ variant: 'secondary', size: 'md' }),
          'w-full justify-between gap-2',
          (activeCount > 0 || isOpen) && 'border-gray-300',
          buttonClassName,
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="flex-1 text-left truncate">{displayLabel}</span>
        <ChevronDownIcon
          className={cn(
            'w-4 h-4 text-gray-500 transition-transform flex-shrink-0',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Desktop popover (portal to escape overflow clipping) */}
      {isOpen &&
        !isMobile &&
        createPortal(
          <div
            ref={popoverRef}
            role="listbox"
            style={popoverStyle}
            className={cn(
              'bg-white border border-gray-100 rounded-[12px] shadow-lg z-[9999] overflow-hidden',
              'max-h-[308px] flex flex-col',
            )}
          >
            <div className="px-4 pt-3 pb-2 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900 leading-[140%] truncate">
                  {popoverTitle}
                </span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs font-medium text-gray-500 leading-[140%] hover:text-gray-900 transition-colors flex-shrink-0 ml-2"
                >
                  {clearLabel}
                </button>
              </div>
              {!hideSearch && searchInput}
            </div>

            <div className="py-1 overflow-auto flex-1 min-h-0">{optionsList}</div>
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
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 pb-safe">
            {/* Drag handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-2" />

            {/* Header */}
            <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">{popoverTitle}</span>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                {clearLabel}
              </button>
            </div>

            {/* Search */}
            {!hideSearch && <div className="px-4 pt-3">{searchInput}</div>}

            {/* Options */}
            <div className="py-1 max-h-52 overflow-auto">{optionsList}</div>

            {/* Done */}
            <div className="px-4 pb-4 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  close();
                }}
                className="w-full py-2.5 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-100 rounded-xl"
              >
                {doneLabel}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
