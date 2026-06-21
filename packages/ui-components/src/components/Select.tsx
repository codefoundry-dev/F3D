import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cn } from '../utils/cn';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Select — native `<select>` styled to the Forethread design system to match
 * the `Input` field: white surface, #E8EAED border, Corner/M radius, subtle
 * shadow-xs, and a 4px blue focus ring (no border-colour change).
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'h-[34px] w-full rounded-[12px] border border-[#E8EAED] bg-white px-2.5 text-[14px] font-medium tracking-[0.3px] text-gray-900',
          'shadow-[0_1px_3px_rgba(10,13,18,0.06),0_1px_1px_rgba(10,13,18,0.02)] outline-none transition-shadow',
          'focus:ring-4 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
          'disabled:cursor-not-allowed disabled:bg-[#F4F4F6] disabled:text-[#6D7588] disabled:shadow-none',
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
