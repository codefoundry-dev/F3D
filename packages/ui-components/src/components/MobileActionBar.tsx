import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useIsPhone } from '../hooks/useIsPhone';
import { cn } from '../utils/cn';

import { Button, type ButtonProps } from './Button';
import { DotActionsMenu, type DotAction } from './DotActionsMenu';
import { useMobileActionBarSlot, useMobileHeaderSlot, useMobileNavHidden } from './MobileChrome';

export interface MobileActionBarProps {
  /** The screen's main action(s). Each direct child gets an equal share. */
  children: ReactNode;
  className?: string;
}

/**
 * Fixed footer bar holding the screen's main action on phones (ADR-0019 B7,
 * FOR-373). Sits just above the bottom nav, or at the very bottom while the nav
 * is hidden (wizards). Children split the width equally, so an Approve/Reject
 * pair is 50/50. Renders nothing at 768px and up — use {@link PageActions} when
 * the same actions also show inline on desktop.
 *
 * Portals into the shell's `MobileActionBarSlot` (which adds an in-flow spacer
 * so content isn't hidden behind the bar); outside the shell (guest pages) it
 * renders in place.
 */
export function MobileActionBar({ children, className }: MobileActionBarProps) {
  const isPhone = useIsPhone();
  const slot = useMobileActionBarSlot();
  const navHidden = useMobileNavHidden();
  if (!isPhone) return null;

  const bar = (
    <>
      <div
        aria-hidden
        className={navHidden ? 'h-[calc(76px+env(safe-area-inset-bottom))]' : 'h-[76px]'}
        data-testid="mobile-action-bar-spacer"
      />
      <div
        data-testid="mobile-action-bar"
        className={cn(
          'fixed inset-x-0 z-30 flex items-center gap-2 border-t border-[#E8EAED] bg-white px-4 pt-2',
          // Every direct child takes an equal share; buttons fill their share
          // and meet the 44px touch minimum.
          '[&>*]:min-w-0 [&>*]:flex-1 [&_button]:min-h-11 [&_button]:w-full',
          navHidden
            ? 'bottom-0 pb-[calc(8px+env(safe-area-inset-bottom))]'
            : 'bottom-[calc(56px+env(safe-area-inset-bottom))] pb-2',
          className,
        )}
      >
        {children}
      </div>
    </>
  );

  return slot ? createPortal(bar, slot) : bar;
}

export interface MobileHeaderActionsProps {
  actions: DotAction[];
  ariaLabel?: string;
}

/**
 * The ⋯ menu of secondary actions in the phone top bar (B7). Opens the same
 * bottom sheet as every other ⋯ menu. Renders nothing on desktop or when there
 * are no actions; outside the shell it renders in place.
 */
export function MobileHeaderActions({
  actions,
  ariaLabel = 'More actions',
}: MobileHeaderActionsProps) {
  const isPhone = useIsPhone();
  const slot = useMobileHeaderSlot();
  if (!isPhone || actions.length === 0) return null;

  const menu = (
    <DotActionsMenu
      actions={actions}
      bordered={false}
      ariaLabel={ariaLabel}
      triggerClassName="size-10 rounded-full p-0 text-gray-700 [&_svg]:size-5"
    />
  );
  return slot ? createPortal(menu, slot) : menu;
}

export interface PageAction extends DotAction {
  /** Desktop button variant. Defaults to `outline`. */
  variant?: ButtonProps['variant'];
  isLoading?: boolean;
  /** Extra props for tests (desktop button only). */
  testId?: string;
}

export interface PageActionsProps {
  /**
   * The screen's main action(s): the fixed footer bar on phones, last inline
   * on desktop. Usually buttons, or a component rendering them (+ its modals).
   */
  primary?: ReactNode;
  /** Everything else: outline buttons on desktop, the top-bar ⋯ menu on phones. */
  secondary?: PageAction[];
  /** Desktop button size for `secondary`. */
  size?: 'sm' | 'md' | 'lg';
  /** Desktop wrapper classes. */
  className?: string;
  /** Accessible name of the phone ⋯ trigger. */
  moreLabel?: string;
}

/**
 * One place for a page's actions (ADR-0019 B7): inline on desktop; on phones
 * the main action moves to {@link MobileActionBar} and the rest to the top-bar
 * ⋯ menu ({@link MobileHeaderActions}). Each action mounts exactly once, so a
 * component carrying its own modal (e.g. Approve/Decline) can be passed as
 * `primary` safely.
 */
export function PageActions({
  primary,
  secondary = [],
  size = 'sm',
  className,
  moreLabel,
}: PageActionsProps) {
  const isPhone = useIsPhone();

  if (isPhone) {
    return (
      <>
        <MobileHeaderActions actions={secondary} ariaLabel={moreLabel} />
        {primary ? <MobileActionBar>{primary}</MobileActionBar> : null}
      </>
    );
  }

  if (!primary && secondary.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {secondary.map((a) => (
        <Button
          key={a.key}
          type="button"
          variant={a.variant ?? 'outline'}
          size={size}
          leftIcon={a.icon}
          disabled={a.disabled}
          isLoading={a.isLoading}
          onClick={a.onClick}
          data-testid={a.testId}
        >
          {a.label}
        </Button>
      ))}
      {primary}
    </div>
  );
}
