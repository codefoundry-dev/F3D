import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

const variantStyles = {
  destructive: 'bg-destructive/10 border-destructive/20 text-destructive',
  success: 'bg-success/10 border-success/20 text-success',
  warning: 'bg-warning/10 border-warning/20 text-warning',
  info: 'bg-primary/10 border-primary/20 text-primary',
} as const;

export interface AlertProps {
  variant: keyof typeof variantStyles;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Alert({ variant, icon, children, className }: AlertProps) {
  return (
    <div className={cn('rounded-xl border px-4 py-3 text-sm', variantStyles[variant], className)}>
      <div className="flex items-start gap-2">
        {icon && <span className="flex-shrink-0 mt-0.5">{icon}</span>}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
