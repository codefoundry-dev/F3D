import EmptyBoxSvg from '../assets/illustrations/empty-box.svg?react';
import { cn } from '../utils/cn';

export interface EmptyBoxIllustrationProps {
  className?: string;
}

/**
 * Design-system "empty box" illustration (open box + speech bubble) used as the
 * default graphic for empty / no-results states. Defaults to 120×120.
 */
export function EmptyBoxIllustration({ className }: EmptyBoxIllustrationProps) {
  return <EmptyBoxSvg className={cn('size-[120px]', className)} aria-hidden />;
}
