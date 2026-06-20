import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../utils/cn';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** DS field size — Small/Medium/Large (h 28/34/48). Defaults to md. */
  inputSize?: InputSize;
  /** Destructive (error) styling. */
  error?: boolean;
}

const sizeStyles: Record<InputSize, { box: string; text: string }> = {
  sm: { box: 'h-7 rounded-[10px] px-2.5 gap-1.5', text: 'text-[12px]' },
  md: { box: 'h-[34px] rounded-[12px] px-2.5 gap-2', text: 'text-[14px]' },
  lg: { box: 'h-12 rounded-[14px] px-3.5 gap-2', text: 'text-[16px]' },
};

/**
 * Input — Forethread design system (Figma node 3621-75237 "Input-base").
 *
 * White field, #E8EAED border, Corner/S radius, subtle shadow-xs; on focus a
 * 4px blue + 2px white ring (no border-colour change); destructive state turns
 * the border + icons red. Leading/trailing icons render as flex children.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, leftIcon, rightIcon, inputSize = 'md', error, disabled, ...props }, ref) => {
    const sz = sizeStyles[inputSize];
    return (
      <div
        className={cn(
          'flex w-full items-center border bg-white text-gray-900 shadow-[0_1px_3px_rgba(10,13,18,0.06),0_1px_1px_rgba(10,13,18,0.02)] transition-shadow',
          sz.box,
          error
            ? 'border-[#B42318] focus-within:ring-4 focus-within:ring-destructive focus-within:ring-offset-2 focus-within:ring-offset-background'
            : 'border-[#E8EAED] focus-within:ring-4 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
          disabled && 'bg-[#F4F4F6] text-[#6D7588] shadow-none',
        )}
      >
        {leftIcon && (
          <span
            className={cn(
              'flex shrink-0 items-center [&_svg]:size-4',
              error ? 'text-[#B42318]' : 'text-gray-500',
            )}
          >
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={cn(
            'min-w-0 flex-1 bg-transparent font-medium tracking-[0.3px] outline-none placeholder:text-gray-500 placeholder:font-normal disabled:cursor-not-allowed',
            sz.text,
            className,
          )}
          {...props}
        />
        {rightIcon && (
          <span
            className={cn(
              'flex shrink-0 items-center [&_svg]:size-4',
              error ? 'text-[#B42318]' : 'text-gray-500',
            )}
          >
            {rightIcon}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
