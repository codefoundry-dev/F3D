import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import CrossIcon from '../assets/icons/cross.svg?react';
import { cn } from '../utils/cn';

/** Convert e.g. "max-w-md" → "toolbar:max-w-md" so the class only applies on desktop (≥900px) */
function toDesktopOnly(cls: string): string {
  return cls
    .split(' ')
    .map((c) => (c.startsWith('toolbar:') ? c : `toolbar:${c}`))
    .join(' ');
}

export interface ModalProps {
  onClose: () => void;
  maxWidth?: string;
  children: ReactNode;
  /**
   * Opt-in "pinned" layout for tall / data-table modals. When true, the desktop
   * card no longer scrolls as a whole — instead it is bounded to 90vh and its
   * children lay out as a flex column so a `ModalHeader` / `ModalFooter` stay
   * fixed and only the `ModalBody` (which becomes the flex child that scrolls)
   * moves. Defaults to the legacy behaviour (whole card scrolls) so existing
   * modals are unaffected.
   */
  scrollBody?: boolean;
}

export function Modal({ onClose, maxWidth, children, scrollBody = false }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const overlay = (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-0 toolbar:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        className={cn(
          'bg-card shadow-xl flex flex-col rounded-none overflow-hidden w-full h-full',
          'toolbar:w-auto toolbar:h-auto toolbar:max-h-[90vh] toolbar:rounded-[20px] toolbar:overflow-y-auto',
          'toolbar:min-w-[560px] toolbar:max-w-[560px]',
          // Pinned layout: card itself stops scrolling (overflow-hidden wins over
          // the desktop overflow-y-auto via tailwind-merge) so the header/footer
          // stay put and the body becomes the scroll region.
          scrollBody && 'toolbar:overflow-hidden',
          maxWidth && toDesktopOnly(maxWidth),
        )}
      >
        {children}
      </div>
    </div>
  );

  // Render through a portal to document.body so the `fixed inset-0` overlay is
  // positioned against the viewport, not against any ancestor that establishes
  // a containing block (transform / filter / will-change / contain). Without
  // this the overlay can be clipped to the app content area and fail to cover
  // the top bar.
  return createPortal(overlay, document.body);
}

export function ModalCloseButton({
  onClose,
  className,
}: {
  onClose: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClose}
      className={cn(
        'flex size-7 items-center justify-center rounded-[8px] text-gray-500 transition-colors hover:bg-gray-700/[0.08] hover:text-gray-700',
        className,
      )}
      aria-label="Close"
    >
      <CrossIcon className="size-4" />
    </button>
  );
}

export function ModalHeader({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border">
      <h2 className="text-lg font-semibold text-foreground">{children}</h2>
      {onClose && <ModalCloseButton onClose={onClose} />}
    </div>
  );
}

export function ModalBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'px-6 py-4 flex-1 flex flex-col min-h-0 overflow-y-auto toolbar:overflow-visible',
        /* On mobile: form stretches, last div (buttons) sticks to bottom via mt-auto.
           On desktop: parent is display:block so flex-1 has no effect. */
        '[&>form]:flex-1 [&>form]:flex [&>form]:flex-col [&>form>div:last-child]:mt-auto',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface ModalIconHeaderProps {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Renders the top-right close button when provided. Omit for wizard steps. */
  onClose?: () => void;
  className?: string;
}

/**
 * Centered modal header — fleshed-out DS: a gradient-white "featured icon" chip
 * (hairline border + layered drop-shadow), Title/M, and a muted subtitle, with
 * an optional top-right close button.
 */
export function ModalIconHeader({
  icon,
  title,
  subtitle,
  onClose,
  className,
}: ModalIconHeaderProps) {
  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <div className="flex w-full items-start justify-between">
        <div className="flex-1" />
        <div className="flex size-12 items-center justify-center rounded-[14px] border border-[#E8EAED] bg-gradient-to-b from-[#F9F9FA] to-white text-gray-700 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
          <span className="flex size-6 items-center justify-center">{icon}</span>
        </div>
        <div className="flex flex-1 justify-end">
          {onClose && <ModalCloseButton onClose={onClose} />}
        </div>
      </div>
      <h2 className="mt-4 text-2xl font-semibold leading-[1.4] text-gray-900">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}

export function ModalFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex justify-end gap-3 px-6 py-4 border-t border-border', className)}>
      {children}
    </div>
  );
}
