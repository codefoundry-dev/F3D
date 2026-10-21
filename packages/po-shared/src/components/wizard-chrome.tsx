import { useTranslation } from '@forethread/i18n';
import { ConfirmDialog, useHideMobileNav, useMobileExitHandler } from '@forethread/ui-components';
import { useState, type ReactNode } from 'react';

/** Fields a wizard marks invalid: RHF/aria, DS error borders, inline error text. */
const INVALID_SELECTOR =
  '[aria-invalid="true"], .border-destructive, [data-invalid="true"], p.text-destructive';

/**
 * Scroll the first invalid field into view and focus it (ADR-0019 B8). Runs on
 * the next frame so the error state the caller just set has rendered. Searches
 * `root` (default: the whole document).
 */
export function scrollToFirstInvalid(root?: ParentNode | null): void {
  const run = () => {
    const el = (root ?? document).querySelector<HTMLElement>(INVALID_SELECTOR);
    if (!el) return;
    el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    const focusable = el.matches('input, select, textarea, button, [tabindex]')
      ? el
      : el.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]');
    focusable?.focus?.({ preventScroll: true });
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
  else run();
}

export interface UseWizardChromeOptions {
  /** True when leaving would lose user input. */
  isDirty: boolean;
  /** Leaves the wizard (usually `navigate(backTo)`). */
  onExit: () => void;
}

/**
 * Phone wizard chrome (ADR-0019 B8, FOR-374): hides the bottom nav while the
 * wizard is mounted, and routes the top-bar back arrow through an
 * unsaved-changes confirm when the form is dirty. Render the returned
 * `exitConfirm` once in the wizard.
 */
export function useWizardChrome({ isDirty, onExit }: UseWizardChromeOptions): {
  exitConfirm: ReactNode;
  requestExit: () => void;
} {
  const { t } = useTranslation('common');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const requestExit = () => (isDirty ? setConfirmOpen(true) : onExit());

  useHideMobileNav();
  useMobileExitHandler(requestExit);

  const exitConfirm = confirmOpen ? (
    <ConfirmDialog
      title={t('unsavedChanges.title', { defaultValue: 'Leave without saving?' })}
      message={t('unsavedChanges.message', {
        defaultValue: 'Your changes will be lost if you leave this page now.',
      })}
      confirmLabel={t('unsavedChanges.leave', { defaultValue: 'Leave' })}
      cancelLabel={t('unsavedChanges.stay', { defaultValue: 'Keep editing' })}
      confirmVariant="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      onConfirm={() => {
        setConfirmOpen(false);
        onExit();
      }}
      onCancel={() => setConfirmOpen(false)}
    />
  ) : null;

  return { exitConfirm, requestExit };
}
