import FilterIcon from '../assets/icons/filter.svg?react';
import { cn } from '../utils/cn';

import { buttonVariants } from './Button';

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
        buttonVariants({ variant: 'secondary', size: 'md' }),
        'gap-2',
        active && 'border-gray-300 bg-gray-50 bg-none',
        className,
      )}
    >
      <FilterIcon className="w-4 h-4" />
      {label}
    </button>
  );
}
