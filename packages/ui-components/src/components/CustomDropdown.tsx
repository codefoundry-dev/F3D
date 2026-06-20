import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import CheckmarkIcon from '../assets/icons/checkmark.svg?react';
import ChevronDownIcon from '../assets/icons/chevron-down.svg?react';
import { cn } from '../utils/cn';

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownActionItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

export interface CustomDropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  leftIcon?: ReactNode;
  error?: boolean;
  disabled?: boolean;
  className?: string;
  actionItem?: DropdownActionItem;
  searchable?: boolean;
  searchPlaceholder?: string;
  grouped?: boolean;
  borderless?: boolean;
}

export function CustomDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  leftIcon,
  error,
  disabled,
  className,
  actionItem,
  searchable,
  searchPlaceholder = 'Search…',
  grouped,
  borderless,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  // Position the portal dropdown relative to the trigger
  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 250;
    // Match the trigger's width so the panel always fits inside whatever
    // container the trigger does (e.g. a modal). Anchoring to a viewport-based
    // max-width let `w-full` children expand the panel to the screen edge and
    // spill out of narrower containers; long option labels simply wrap instead.
    setPortalStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  }, [isOpen]);

  const filteredOptions =
    searchable && searchQuery
      ? options.filter((o) => o.label.toLowerCase().includes(searchQuery.toLowerCase()))
      : options;

  const groupedOptions = useMemo(() => {
    if (!grouped) return null;
    const sorted = [...filteredOptions].sort((a, b) => a.label.localeCompare(b.label));
    const groups = new Map<string, DropdownOption[]>();
    for (const opt of sorted) {
      const letter = opt.label.charAt(0).toUpperCase();
      const group = groups.get(letter) ?? [];
      group.push(opt);
      groups.set(letter, group);
    }
    return groups;
  }, [grouped, filteredOptions]);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !portalRef.current?.contains(target)
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

  // Letter-press navigation for grouped mode
  useEffect(() => {
    if (!isOpen || !grouped || !listRef.current) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        // Don't intercept when search input is focused
        if (searchable && document.activeElement === searchInputRef.current) return;
        const letter = e.key.toUpperCase();
        const header = listRef.current?.querySelector(`[data-group-letter="${letter}"]`);
        if (header) header.scrollIntoView({ block: 'nearest' });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, grouped, searchable]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus({ preventScroll: true });
    }
  }, [isOpen, searchable]);

  const handleSelect = (optionValue: string) => {
    onChange?.(optionValue);
    close();
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center py-2.5 text-sm transition-colors',
          'focus:outline-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          leftIcon ? 'pl-10 pr-3' : 'px-3',
          borderless
            ? 'bg-transparent border-0'
            : cn(
                'border bg-muted rounded-lg focus:border-foreground/50 focus:bg-muted',
                error ? 'border-destructive' : 'border-input',
                isOpen && 'border-foreground/50 bg-muted',
              ),
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {leftIcon}
          </span>
        )}
        <span
          className={cn('flex-1 text-left truncate', !selectedOption && 'text-muted-foreground')}
        >
          {selectedOption?.label ?? placeholder}
        </span>
        {/* Chevron */}
        <ChevronDownIcon
          className={cn(
            'w-4 h-4 ml-2 text-muted-foreground transition-transform flex-shrink-0',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={(el) => {
              (portalRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
              (listRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
            }}
            role="listbox"
            style={portalStyle}
            className="z-[9999] max-h-60 overflow-auto rounded-[12px] border border-gray-100 bg-white p-1 shadow-[0_12px_16px_-4px_rgba(10,13,18,0.08),0_4px_6px_-2px_rgba(10,13,18,0.03)]"
          >
            {searchable && (
              <div className="px-2 py-1.5">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full px-2.5 py-1.5 text-sm bg-muted border border-input rounded-lg focus:outline-none focus:border-foreground/50 focus:bg-muted text-foreground placeholder:text-muted-foreground"
                />
              </div>
            )}

            {grouped && groupedOptions
              ? Array.from(groupedOptions.entries()).map(([letter, opts]) => (
                  <div key={letter}>
                    <div
                      data-group-letter={letter}
                      className="sticky top-0 px-3 py-1 text-xs font-semibold text-muted-foreground bg-card border-b border-border"
                    >
                      {letter}
                    </div>
                    {opts.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={option.value === value}
                        onClick={() => handleSelect(option.value)}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-[8px] px-2.5 py-2 text-left text-sm transition-colors',
                          option.value === value
                            ? 'bg-gray-50 font-semibold text-gray-900'
                            : 'text-gray-700 hover:bg-gray-50',
                        )}
                      >
                        <span className="truncate">{option.label}</span>
                        {option.value === value && (
                          <CheckmarkIcon className="size-4 shrink-0 text-gray-900" />
                        )}
                      </button>
                    ))}
                  </div>
                ))
              : filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-[8px] px-2.5 py-2 text-left text-sm transition-colors',
                      option.value === value
                        ? 'bg-gray-50 font-semibold text-gray-900'
                        : 'text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {option.value === value && (
                      <CheckmarkIcon className="size-4 shrink-0 text-gray-900" />
                    )}
                  </button>
                ))}

            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No options</div>
            )}

            {actionItem && (
              <>
                <div className="my-1 border-t border-gray-100" />
                <button
                  type="button"
                  onClick={() => {
                    actionItem.onClick();
                    close();
                  }}
                  className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                >
                  {actionItem.icon}
                  {actionItem.label}
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
