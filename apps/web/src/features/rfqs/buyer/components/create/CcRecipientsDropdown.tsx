import CheckmarkIcon from '@forethread/ui-components/assets/icons/checkmark.svg?react';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import { useEffect, useRef, useState } from 'react';

export interface CcRecipientOption {
  id: string;
  name: string;
  email: string;
}

interface CcRecipientsDropdownProps {
  id?: string;
  options: CcRecipientOption[];
  /** Selected recipients' email addresses. */
  value: string[];
  onChange: (emails: string[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

/** What the closed trigger reads: the picked names, or a count once it gets long. */
function summarise(selected: CcRecipientOption[]): string | null {
  if (selected.length === 0) return null;
  if (selected.length <= 2) return selected.map((o) => o.name).join(', ');
  return `${selected.length} people selected`;
}

/**
 * Multi-select dropdown of colleagues to CC on an RFQ. Mirrors the design-system
 * `CustomDropdown` (trigger, panel, option rows) but stays open while picking and
 * toggles each row, since `CustomDropdown` is single-select only.
 */
export function CcRecipientsDropdown({
  id,
  options,
  value,
  onChange,
  isLoading,
  disabled,
}: CcRecipientsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) searchRef.current?.focus({ preventScroll: true });
  }, [isOpen]);

  // Close on outside click / Escape, matching CustomDropdown.
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const selected = options.filter((o) => value.includes(o.email));
  const summary = summarise(selected);

  const query = search.trim().toLowerCase();
  const visible = query
    ? options.filter(
        (o) => o.name.toLowerCase().includes(query) || o.email.toLowerCase().includes(query),
      )
    : options;

  const toggle = (email: string) => {
    onChange(value.includes(email) ? value.filter((e) => e !== email) : [...value, email]);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          setIsOpen((prev) => !prev);
          setSearch('');
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        data-testid="send-rfq-cc"
        className={`flex w-full items-center rounded-lg border bg-muted px-3 py-2.5 text-base transition-colors focus:border-foreground/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 max-md:min-h-11 md:text-sm ${
          isOpen ? 'border-foreground/50' : 'border-input'
        }`}
      >
        <span className={`flex-1 truncate text-left ${summary ? '' : 'text-muted-foreground'}`}>
          {summary ?? 'Select people to CC'}
        </span>
        <ChevronDownIcon
          className={`ml-2 h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        // In-flow, not an absolute popover: the dialog card scrolls its overflow, so
        // a floating panel would be clipped. Expanding in place grows the dialog.
        <div className="mt-1 rounded-[12px] border border-gray-100 bg-white p-1 shadow-[0_12px_16px_-4px_rgba(10,13,18,0.08),0_4px_6px_-2px_rgba(10,13,18,0.03)]">
          <div className="px-2 py-1.5">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people…"
              aria-label="Search people"
              className="w-full rounded-lg border border-input bg-muted px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/50 focus:outline-none"
            />
          </div>

          <div role="listbox" aria-multiselectable="true" className="max-h-48 overflow-auto">
            {visible.map((option) => {
              const isSelected = value.includes(option.email);
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => toggle(option.email)}
                  data-testid={`send-rfq-cc-option-${option.id}`}
                  className={`flex w-full items-center justify-between gap-2 rounded-[8px] px-2.5 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                    isSelected ? 'bg-gray-50 text-gray-900' : 'text-gray-700'
                  }`}
                >
                  <span className="min-w-0">
                    <span className={`block truncate ${isSelected ? 'font-semibold' : ''}`}>
                      {option.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.email}
                    </span>
                  </span>
                  {isSelected && <CheckmarkIcon className="size-4 shrink-0 text-gray-900" />}
                </button>
              );
            })}

            {visible.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {isLoading ? 'Loading people…' : 'No people found'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
