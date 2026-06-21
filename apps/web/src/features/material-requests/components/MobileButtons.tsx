import { Button, cn } from '@forethread/ui-components';
import ArrowRightIcon from '@forethread/ui-components/assets/icons/arrow-right.svg?react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Primary action used by the Material Request pages — the page CTAs ("Request
 * Materials", "New Request") and wizard navigation ("Next", "Submit Request").
 * A thin wrapper over the DS Button so the flow shares the app-wide styling.
 * Auto-width by default (it sits in the header/card action bars); pass
 * `className="w-full sm:w-auto"` where a full-width mobile target is wanted.
 *
 * Always `type="button"`: the wizard never uses a native form submit, which
 * avoids the step→final button-morph submit bug.
 */
interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Trailing arrow icon (the "Next" affordance). */
  withArrow?: boolean;
  /** Leading icon slot (e.g. the plus on "New Request"). */
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
      size="md"
      disabled={disabled}
      leftIcon={leading}
      rightIcon={withArrow ? <ArrowRightIcon className="size-4" /> : undefined}
      className={cn('justify-center', className)}
      {...rest}
    >
      {children}
    </Button>
  );
}

/** Secondary action — the "View My Requests"/"Raise PO" buttons. */
export function SecondaryButton({
  children,
  className,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="md"
      disabled={disabled}
      className={cn('justify-center', className)}
      {...rest}
    >
      {children}
    </Button>
  );
}
