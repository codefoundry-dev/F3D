import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '../utils/cn';

/**
 * Card — Forethread design system surface (Figma "Cards" node 4384-95392).
 *
 * A white rounded container with a Gray-100 (#E8EAED) hairline border and the
 * DS shadow-xs. `padding` toggles the default inner spacing; `interactive` adds
 * hover/press affordances for clickable cards.
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
} as const;

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ padding = 'md', interactive, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-[12px] border border-gray-100 bg-white shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]',
        paddingStyles[padding],
        interactive &&
          'cursor-pointer transition-colors hover:border-gray-200 hover:bg-gray-25 active:bg-gray-50',
        className,
      )}
      {...props}
    />
  ),
);

Card.displayName = 'Card';
