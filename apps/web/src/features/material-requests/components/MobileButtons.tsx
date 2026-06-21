import { Button, cn } from '@forethread/ui-components';
import ArrowRightIcon from '@forethread/ui-components/assets/icons/arrow-right.svg?react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Full-width primary action used in the wizard footers (Figma 2002:176 —
 * "Next", "Submit Request", "Done"). Thin wrapper over the DS Button so the
 * Material Request flow shares the app-wide button styling. Always
 * `type="button"`: the wizard never uses a native form submit, which avoids the
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
    <Button
      type="button"
      variant="primary"
      size="lg"
      disabled={disabled}
      leftIcon={leading}
      rightIcon={withArrow ? <ArrowRightIcon className="size-4" /> : undefined}
      className={cn('w-full justify-center', className)}
      {...rest}
    >
      {children}
    </Button>
  );
}

/** Full-width secondary action — the "Back"/"Raise PO" buttons. */
export function SecondaryButton({
  children,
  className,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      disabled={disabled}
      className={cn('w-full justify-center', className)}
      {...rest}
    >
      {children}
    </Button>
  );
}
