import FilterIcon from '../assets/icons/filter.svg?react';
import { cn } from '../utils/cn';

export interface FiltersButtonProps {
  active?: boolean;
  onClick: () => void;
  label?: string;
  className?: string;
}

export function FiltersButton({
  active,
  onClick,
  label = 'Filters',
  className,
}: FiltersButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 h-10 px-3 rounded-[12px] border text-sm font-medium transition-colors text-foreground',
        active ? 'border-foreground' : 'border-foreground/20 hover:border-foreground/40',
        className,
      )}
    >
      <FilterIcon className="w-4 h-4" />
      {label}
    </button>
  );
}
