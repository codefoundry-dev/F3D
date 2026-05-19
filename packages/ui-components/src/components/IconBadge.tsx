import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

export interface IconBadgeProps {
  icon: ReactNode;
  className?: string;
}

export function IconBadge({ icon, className }: IconBadgeProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center w-12 h-12 rounded-[12px] bg-foreground/10',
        className,
      )}
    >
      <span className="flex items-center justify-center w-6 h-6">{icon}</span>
    </div>
  );
}
