import { useEffect, type ReactNode } from 'react';

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
}

export function Modal({ onClose, maxWidth, children }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
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
          'toolbar:w-auto toolbar:h-auto toolbar:max-h-[90vh] toolbar:rounded-lg toolbar:overflow-y-auto',
          'toolbar:min-w-[560px] toolbar:max-w-[560px]',
          maxWidth && toDesktopOnly(maxWidth),
        )}
      >
        {children}
      </div>
    </div>
  );
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
      className={cn('text-muted-foreground hover:text-foreground transition-colors', className)}
      aria-label="Close"
    >
      <CrossIcon className="w-3 h-3" />
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
  onClose: () => void;
  /** Gap below header, default mb-10 */
  className?: string;
}

/**
 * Centered modal header with icon badge, title, subtitle, and close button.
 * Reuses IconBadge for the icon container.
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
      <div className="w-full flex justify-between items-start">
        <div className="flex-1" />
        <div className="flex items-center justify-center w-12 h-12 rounded-[12px] bg-foreground/10">
          <span className="flex items-center justify-center w-6 h-6">{icon}</span>
        </div>
        <div className="flex-1 flex justify-end">
          <ModalCloseButton onClose={onClose} />
        </div>
      </div>
      <h2 className="text-2xl text-foreground mt-3">{title}</h2>
      {subtitle && <p className="text-lg text-muted-foreground mt-2">{subtitle}</p>}
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
