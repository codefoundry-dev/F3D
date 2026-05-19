import SpinnerIcon from '../assets/icons/spinner.svg?react';
import { cn } from '../utils/cn';

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
} as const;

export interface SpinnerProps {
  size?: keyof typeof sizeStyles;
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <SpinnerIcon className={cn('animate-spin text-foreground', sizeStyles[size], className)} />
  );
}

export function PageLoader() {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center">
      <Spinner size="xl" />
    </div>
  );
}
