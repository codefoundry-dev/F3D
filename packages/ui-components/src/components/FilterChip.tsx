import { cn } from '../utils/cn';

export interface FilterChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function FilterChip({ label, active, onClick, className }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-9 px-3.5 text-sm rounded-xl border whitespace-nowrap transition-colors',
        active
          ? 'bg-filter-chip text-filter-chip-foreground border-filter-chip'
          : 'border-foreground/20 text-foreground hover:bg-accent',
        className,
      )}
    >
      {label}
    </button>
  );
}
