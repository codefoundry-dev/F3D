import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cn } from '../utils/cn';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full px-3 py-2 border border-input rounded-md text-sm bg-card',
          'focus:outline-none focus:border-foreground/50 focus:bg-muted',
          'disabled:bg-muted disabled:text-muted-foreground',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);

Select.displayName = 'Select';
