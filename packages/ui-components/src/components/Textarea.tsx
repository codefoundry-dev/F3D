import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '../utils/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

/**
 * Textarea — Forethread design system (Figma node 3621-75237).
 * Matches the Input field chrome: white, #E8EAED border, Corner/S radius,
 * shadow-xs, blue focus ring; destructive state turns the border red.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full resize-none rounded-[12px] border bg-white px-2.5 py-2 text-[14px] font-medium tracking-[0.3px] text-gray-900',
          'shadow-[0_1px_3px_rgba(10,13,18,0.06),0_1px_1px_rgba(10,13,18,0.02)] transition-shadow',
          'outline-none placeholder:font-normal placeholder:text-gray-500',
          'focus:ring-4 focus:ring-offset-2 focus:ring-offset-background',
          'disabled:bg-[#F4F4F6] disabled:text-[#6D7588] disabled:shadow-none',
          error ? 'border-[#B42318] focus:ring-destructive' : 'border-[#E8EAED] focus:ring-ring',
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = 'Textarea';
