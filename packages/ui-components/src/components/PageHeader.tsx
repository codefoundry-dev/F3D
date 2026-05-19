import { type ReactNode } from 'react';

import BackArrowIcon from '../assets/icons/back-arrow.svg?react';
import { cn } from '../utils/cn';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backIcon?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, onBack, backIcon, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3 min-w-0', className)}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
        >
          {backIcon ?? <BackArrowIcon className="w-5 h-5" />}
        </button>
      )}
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-foreground leading-tight truncate">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground leading-tight truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
