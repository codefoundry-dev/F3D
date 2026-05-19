import { useEffect, useRef, useState } from 'react';

import ChevronDownIcon from '../assets/icons/chevron-down.svg?react';
import { cn } from '../utils/cn';

import { Checkbox } from './Checkbox';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectDropdownProps {
  value?: string;
  onChange?: (value: string) => void;
  /** Multi-select: array of selected values */
  selected?: string[];
  /** Multi-select: callback when selection changes */
  onSelectedChange?: (selected: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  /** Message shown when options array is empty */
  emptyMessage?: string;
}

export function SelectDropdown({
  value,
  onChange,
  selected,
  onSelectedChange,
  options,
  placeholder = 'Select...',
  className,
  emptyMessage = 'No options found',
}: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isMulti = !!onSelectedChange;
  const selectedOption = !isMulti ? options.find((o) => o.value === value) : undefined;

  // Build display label for multi-select
  const displayLabel = isMulti
    ? selected && selected.length > 0
      ? selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? placeholder)
        : `${selected.length} selected`
      : undefined
    : selectedOption?.label;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [isOpen]);

  const toggleOption = (val: string) => {
    if (!selected || !onSelectedChange) return;
    if (selected.includes(val)) {
      onSelectedChange(selected.filter((v) => v !== val));
    } else {
      onSelectedChange([...selected, val]);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className={cn(
          'flex items-center justify-between w-full h-10 px-3 border border-border rounded-lg text-sm transition-colors hover:border-foreground/40',
          isOpen && 'border-foreground/50 bg-muted',
          displayLabel ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        <span className="truncate">{displayLabel ?? placeholder}</span>
        <ChevronDownIcon
          className={cn(
            'w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-full bg-card border border-border rounded-xl shadow-lg z-50 py-1 max-h-48 overflow-auto">
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground text-center">
              {emptyMessage}
            </div>
          ) : isMulti ? (
            options.map((opt) => (
              <div key={opt.value} className="px-3 py-1.5">
                <Checkbox
                  checked={selected?.includes(opt.value) ?? false}
                  onChange={() => toggleOption(opt.value)}
                  label={opt.label}
                />
              </div>
            ))
          ) : (
            options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange?.(opt.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-sm transition-colors',
                  opt.value === value
                    ? 'text-foreground bg-accent font-medium'
                    : 'text-card-foreground hover:bg-accent',
                )}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
