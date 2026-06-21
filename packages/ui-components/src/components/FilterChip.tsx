import { cn } from '../utils/cn';

import { buttonVariants } from './Button';

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
        buttonVariants({ variant: active ? 'primary' : 'secondary', size: 'md' }),
        'whitespace-nowrap',
        className,
      )}
    >
      {label}
    </button>
  );
}
