import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../utils/cn';

const variantStyles = {
  primary: 'bg-foreground text-background hover:bg-foreground/90',
  secondary: 'bg-muted text-foreground hover:bg-muted/80',
  outline:
    'bg-background border border-foreground/20 text-card-foreground hover:bg-accent hover:text-foreground',
  ghost: 'text-muted-foreground hover:text-foreground hover:bg-accent',
  destructive: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
  info: 'bg-primary text-primary-foreground hover:bg-primary/90',
} as const;

const sizeStyles = {
  sm: 'px-3 h-8 text-xs',
  md: 'px-4 h-10 text-sm',
  lg: 'px-6 h-[52px] text-lg leading-6',
} as const;

const iconOnlySizeStyles = {
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-[52px]',
} as const;

export type ButtonVariant = keyof typeof variantStyles;
export type ButtonSize = keyof typeof sizeStyles;

export function buttonVariants({
  variant = 'primary',
  size = 'md',
  iconOnly,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  className?: string;
} = {}) {
  return cn(
    'inline-flex items-center justify-center font-medium rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
    variantStyles[variant],
    iconOnly ? iconOnlySizeStyles[size] : sizeStyles[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading,
      leftIcon,
      rightIcon,
      iconOnly,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled ?? isLoading}
        className={buttonVariants({ variant, size, iconOnly, className })}
        {...props}
      >
        {isLoading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <span className="inline-flex items-center gap-2">
            {leftIcon}
            {children}
            {rightIcon}
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
