import ArrowRightIcon from '@forethread/ui-components/assets/icons/arrow-right.svg?react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Full-width primary action (#171717, white label) used in the wizard footers
 * (Figma 2002:176 — "Next", "Submit Request", "Done"). Always `type="button"`:
 * the wizard never uses a native form submit, which avoids the
 * step→final button-morph submit bug.
 */
interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Trailing arrow icon (the "Next" affordance). */
  withArrow?: boolean;
  /** Leading icon slot (e.g. the check on Submit/Done). */
  leading?: ReactNode;
}

export function PrimaryButton({
  children,
  withArrow,
  leading,
  className,
  disabled,
  ...rest
}: PrimaryButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex h-[51px] w-full items-center justify-center gap-3 rounded-lg bg-[#171717] px-4 text-base font-normal text-white transition-colors hover:bg-[#262626] disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ''}`}
      {...rest}
    >
      {leading}
      {children}
      {withArrow && <ArrowRightIcon className="h-4 w-4" />}
    </button>
  );
}

/** Full-width secondary action (white surface, dark label) — the "Back"/"Raise PO" buttons. */
export function SecondaryButton({
  children,
  className,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex h-[51px] w-full items-center justify-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-4 text-base font-normal text-[#171717] transition-colors hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ''}`}
      {...rest}
    >
      {children}
    </button>
  );
}
