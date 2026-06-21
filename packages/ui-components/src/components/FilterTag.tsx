import CrossIcon from '../assets/icons/cross.svg?react';
import { cn } from '../utils/cn';

export interface FilterTagProps {
  /** Text shown inside the chip (the selected filter value). */
  label: string;
  /** Called when the user clicks the remove (×) icon. Omit to render a static chip. */
  onRemove?: () => void;
  /** Accessible label for the remove button (e.g. "Remove Company Admin filter"). */
  removeLabel?: string;
  className?: string;
}

/**
 * Removable filter chip ("Tag") shown in an active-filters bar — a light-gray
 * rounded pill holding a single applied filter value plus a × to clear it.
 * Matches the DS "Tags / M" component (h-28, rounded-10, gray-700 @ 10% fill).
 */
export function FilterTag({ label, onRemove, removeLabel, className }: FilterTagProps) {
  return (
    <span
      className={cn(
        'inline-flex h-7 max-h-7 items-center gap-1.5 overflow-hidden rounded-[10px] bg-gray-700/10 px-1.5',
        className,
      )}
    >
      <span className="px-0.5 text-sm font-medium leading-[1.4] tracking-[0.3px] text-gray-700">
        {label}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove ${label}`}
          className="flex size-4 shrink-0 items-center justify-center text-gray-500 transition-colors hover:text-gray-900"
        >
          <CrossIcon className="size-4" />
        </button>
      )}
    </span>
  );
}
