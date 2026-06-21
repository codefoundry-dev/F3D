import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../utils/cn';

/**
 * Button — Forethread design system (Figma node 3581-46580).
 *
 * Hierarchies: primary (dark charcoal gradient), accent (orange), secondary
 * (white + border), tertiary (ghost), destructive (red), link (text).
 * Legacy aliases kept for back-compat: `outline` → secondary, `ghost` → tertiary,
 * `info` → legacy blue solid. Sizes map to the DS Small/Medium/Large (h 28/34/48).
 */
const variantStyles = {
  primary:
    'border bg-[#1B1E22] bg-gradient-to-b from-[#090A0B] to-[#2D3139] border-[#40454F] text-white shadow-[0_2px_12px_0_rgba(10,13,18,0.12),0_1px_2px_0_rgba(10,13,18,0.06)] hover:bg-none hover:bg-[#40454F] hover:border-[#2D3139] active:bg-none active:bg-[#090A0B] active:border-[#2D3139] disabled:bg-none disabled:bg-[#D2D5DB] disabled:border-transparent disabled:text-[#6D7588] disabled:shadow-none',
  accent:
    'border bg-[#EC6629] bg-gradient-to-b from-[#E04F16] to-[#F77E3C] border-[#E04F16] text-white shadow-accent-glow hover:bg-none hover:bg-[#E04F16] hover:border-[#B93815] active:bg-none active:bg-[#B93815] active:border-[#772917] disabled:bg-none disabled:bg-[#FDEAD7] disabled:border-transparent disabled:text-[#6D7588] disabled:shadow-none',
  secondary:
    'border bg-[#FCFCFD] bg-gradient-to-b from-[#F9F9FA] to-white border-[#E8EAED] text-[#2D3139] shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)] hover:bg-none hover:bg-[#F9F9FA] hover:border-[#D2D5DB] active:bg-none active:bg-[#F4F4F6] active:border-[#E8EAED] disabled:bg-none disabled:bg-[#F4F4F6] disabled:border-[#E8EAED] disabled:text-[#6D7588] disabled:shadow-none',
  tertiary:
    'border border-transparent bg-transparent text-[#1B1D22] hover:bg-[#F4F4F6] active:bg-[#E8EAED] disabled:bg-transparent disabled:text-[#6D7588]',
  destructive:
    'border bg-[#D92D20] border-[#B42318] text-white shadow-[0_1px_2px_0_rgba(10,13,18,0.05)] hover:bg-[#B42318] hover:border-[#8E1D15] active:bg-[#8E1D15] active:border-[#59120D] disabled:bg-[#FEE4E2] disabled:border-transparent disabled:text-[#6D7588] disabled:shadow-none',
  link: 'border-0 bg-transparent p-0 text-[#1B1D22] underline-offset-4 hover:text-[#175CD3] hover:underline active:text-[#102A56] disabled:text-[#6D7588] disabled:no-underline',
  /* ── Legacy aliases (kept so existing call-sites compile & stay on-design) ── */
  outline:
    'border bg-[#FCFCFD] bg-gradient-to-b from-[#F9F9FA] to-white border-[#E8EAED] text-[#2D3139] shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)] hover:bg-none hover:bg-[#F9F9FA] hover:border-[#D2D5DB] active:bg-none active:bg-[#F4F4F6] disabled:bg-none disabled:bg-[#F4F4F6] disabled:border-[#E8EAED] disabled:text-[#6D7588] disabled:shadow-none',
  ghost:
    'border border-transparent bg-transparent text-[#1B1D22] hover:bg-[#F4F4F6] active:bg-[#E8EAED] disabled:bg-transparent disabled:text-[#6D7588]',
  info: 'border border-transparent bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 disabled:opacity-60',
} as const;

const sizeStyles = {
  sm: 'h-7 gap-1.5 rounded-[10px] px-2.5 text-[12px]',
  md: 'h-[34px] gap-2 rounded-[12px] px-3 text-[14px]',
  lg: 'h-12 gap-2.5 rounded-[14px] px-5 text-[16px]',
} as const;

const iconOnlySizeStyles = {
  sm: 'size-7 rounded-[10px]',
  md: 'size-[34px] rounded-[12px]',
  lg: 'size-12 rounded-[14px]',
} as const;

/** Link variant ignores button geometry — render as inline text at the right size. */
const linkSizeStyles = {
  sm: 'text-[12px]',
  md: 'text-[14px]',
  lg: 'text-[16px]',
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
  const base =
    'inline-flex items-center justify-center font-semibold leading-none tracking-[0.3px] transition-[color,background-color,border-color,box-shadow] disabled:cursor-not-allowed select-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

  const sizing =
    variant === 'link'
      ? linkSizeStyles[size]
      : iconOnly
        ? iconOnlySizeStyles[size]
        : sizeStyles[size];

  return cn(base, variantStyles[variant], sizing, className);
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
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
