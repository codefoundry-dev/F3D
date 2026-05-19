import ArrowDownIcon from '../assets/icons/arrow-down.svg?react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortIconProps {
  active?: boolean;
  direction?: SortDirection;
}

export function SortIcon({ active = false, direction = null }: SortIconProps) {
  if (active && direction === 'asc') {
    return (
      <span className="inline-flex items-center flex-shrink-0 text-[hsl(var(--sort-icon))]">
        <ArrowDownIcon className="w-3 h-3 scale-y-[-1]" />
      </span>
    );
  }

  if (active && direction === 'desc') {
    return (
      <span className="inline-flex items-center flex-shrink-0 text-[hsl(var(--sort-icon))]">
        <ArrowDownIcon className="w-3 h-3" />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center flex-shrink-0 -space-x-2 text-[hsl(var(--sort-icon))]">
      <ArrowDownIcon className="w-3 h-3 scale-y-[-1]" />
      <ArrowDownIcon className="w-3 h-3" />
    </span>
  );
}
