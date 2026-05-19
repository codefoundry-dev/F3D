import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

export interface InfoHintProps {
  icon?: ReactNode;
  children: ReactNode;
  color?: string;
  width?: string;
  className?: string;
}

export function InfoHint({ icon, children, color, width, className }: InfoHintProps) {
  return (
    <div
      className={cn(
        'absolute right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-50 px-3 py-2.5 flex items-start gap-2',
        className,
      )}
      style={{
        width: width ?? '400px',
        color: color ?? undefined,
      }}
    >
      {icon && <span className="flex-shrink-0 mt-0.5">{icon}</span>}
      <span className="text-xs leading-relaxed">{children}</span>
    </div>
  );
}
