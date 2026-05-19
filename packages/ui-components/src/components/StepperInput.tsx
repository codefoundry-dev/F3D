import type { InputHTMLAttributes } from 'react';
import { forwardRef, useCallback } from 'react';

import { cn } from '../utils/cn';
import { onDigitsOnly } from '../utils/inputFilters';

export interface StepperInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: string;
  onValueChange: (value: string) => void;
  min?: number;
  step?: number;
}

export const StepperInput = forwardRef<HTMLInputElement, StepperInputProps>(
  ({ className, value, onValueChange, min = 0, step = 1, disabled, ...props }, ref) => {
    const increment = useCallback(() => {
      const cur = parseInt(value, 10) || 0;
      onValueChange(String(cur + step));
    }, [value, onValueChange, step]);

    const decrement = useCallback(() => {
      const cur = parseInt(value, 10) || 0;
      if (cur - step >= min) onValueChange(String(cur - step));
    }, [value, onValueChange, step, min]);

    return (
      <div className="relative w-full">
        <input
          ref={ref}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={onDigitsOnly}
          disabled={disabled}
          className={cn(
            'w-full py-2.5 pr-8 px-3 border border-input bg-muted rounded-xl text-sm placeholder-muted-foreground',
            'focus:outline-none focus:border-foreground/50 focus:bg-muted',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className,
          )}
          {...props}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-px">
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            className="p-0.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
            onClick={increment}
          >
            <svg width="14" height="14" viewBox="0 0 256 256" fill="none">
              <path
                d="M213.66 165.66a8 8 0 01-11.32 0L128 91.31 53.66 165.66a8 8 0 01-11.32-11.32l80-80a8 8 0 0111.32 0l80 80a8 8 0 010 11.32z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            className="p-0.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
            onClick={decrement}
          >
            <svg width="14" height="14" viewBox="0 0 256 256" fill="none">
              <path
                d="M213.66 101.66l-80 80a8 8 0 01-11.32 0l-80-80a8 8 0 0111.32-11.32L128 164.69l74.34-74.35a8 8 0 0111.32 11.32z"
                fill="currentColor"
              />
            </svg>
          </button>
        </span>
      </div>
    );
  },
);

StepperInput.displayName = 'StepperInput';
