import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /**
   * Optional illustration (e.g. the DS empty-box graphic) rendered above the
   * title. Sized by the caller — typically a ~120px illustration.
   */
  illustration?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Override the title typography (e.g. bump to 24px for no-results states). */
  titleClassName?: string;
}

export function EmptyState({
  title,
  description,
  illustration,
  action,
  className,
  titleClassName,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-8 px-6 py-12 text-center',
        className,
      )}
    >
      {illustration && <div className="shrink-0">{illustration}</div>}
      <div className="flex flex-col items-center gap-2">
        <p
          className={cn(
            'text-[20px] font-medium leading-[1.4] tracking-[0.3px] text-gray-900',
            titleClassName,
          )}
        >
          {title}
        </p>
        {description && (
          <p className="max-w-md text-[16px] font-medium leading-[1.4] tracking-[0.3px] text-gray-500">
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
