import { useEffect, useRef, useState } from 'react';

import CheckmarkIcon from '../assets/icons/checkmark.svg?react';
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
          'flex h-[34px] w-full items-center justify-between gap-2 rounded-[12px] border bg-white px-2.5 text-[14px] font-medium tracking-[0.3px] shadow-[0_1px_3px_rgba(10,13,18,0.06),0_1px_1px_rgba(10,13,18,0.02)] transition-shadow',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isOpen ? 'border-[#D2D5DB]' : 'border-[#E8EAED] hover:border-[#D2D5DB]',
          displayLabel ? 'text-gray-900' : 'text-gray-500',
        )}
      >
        <span className="truncate">{displayLabel ?? placeholder}</span>
        <ChevronDownIcon
          className={cn(
            'size-4 shrink-0 text-gray-500 transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-1.5 max-h-60 w-full overflow-auto rounded-[12px] border border-gray-100 bg-white p-1 shadow-[0_12px_16px_-4px_rgba(10,13,18,0.08),0_4px_6px_-2px_rgba(10,13,18,0.03)]">
          {options.length === 0 ? (
            <div className="px-3 py-2.5 text-center text-[13px] text-gray-500">{emptyMessage}</div>
          ) : isMulti ? (
            options.map((opt) => (
              <div key={opt.value} className="rounded-[8px] px-2.5 py-2 hover:bg-gray-50">
                <Checkbox
                  checked={selected?.includes(opt.value) ?? false}
                  onChange={() => toggleOption(opt.value)}
                  label={opt.label}
                />
              </div>
            ))
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange?.(opt.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-[8px] px-2.5 py-2 text-left text-[14px] transition-colors',
                    isSelected
                      ? 'bg-gray-50 font-semibold text-gray-900'
                      : 'text-gray-700 hover:bg-gray-50',
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <CheckmarkIcon className="size-4 shrink-0 text-gray-900" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
