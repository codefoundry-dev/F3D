import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '../utils/cn';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full px-3 py-2 border border-input rounded-md text-sm placeholder-muted-foreground',
          'focus:outline-none focus:border-foreground/50 focus:bg-muted resize-none',
          'disabled:bg-muted disabled:text-muted-foreground',
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = 'Textarea';
