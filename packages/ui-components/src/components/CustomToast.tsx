import { type ReactNode } from 'react';
import { toast, type ExternalToast } from 'sonner';

import CheckCircleIcon from '../assets/icons/checkcircle-icon.svg?react';
import CrossInCircleIcon from '../assets/icons/cross-in-circle.svg?react';
import CrossIcon from '../assets/icons/cross.svg?react';
import InfoIcon from '../assets/icons/info.svg?react';
import { cn } from '../utils/cn';

type ToastType = 'success' | 'error' | 'info';

/** Optional inline action rendered as a white pill before the close button. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface CustomToastProps {
  type: ToastType;
  message: string;
  onClose?: () => void;
  /** Optional call-to-action button (e.g. "View"). */
  action?: ToastAction;
  /** Override the default per-type icon (e.g. a check on an info-tinted toast). */
  icon?: ReactNode;
}

/**
 * Per-type tinted surface — Forethread design system
 * ("Notifications / Alerts / Toast" Figma 3719-72068 / 3719-72110).
 *
 * Each state is a subtle vertical gradient surface (hue-100 → hue-25) + hue-200
 * border + a hue-600 icon, with Gray-900 copy. `info` maps to the Figma
 * "Notification" (indigo) state.
 */
const typeStyles: Record<ToastType, { Icon: typeof InfoIcon; surface: string; icon: string }> = {
  success: {
    Icon: CheckCircleIcon,
    surface: 'from-success-100 to-success-25 border-success-200',
    icon: 'text-success-600',
  },
  error: {
    Icon: CrossInCircleIcon,
    surface: 'from-destructive-100 to-destructive-25 border-destructive-200',
    icon: 'text-destructive-600',
  },
  info: {
    Icon: InfoIcon,
    surface: 'from-indigo-100 to-indigo-25 border-indigo-200',
    icon: 'text-indigo-600',
  },
};

function CustomToast({ type, message, onClose, action, icon }: CustomToastProps) {
  const { Icon, surface, icon: iconColor } = typeStyles[type];

  return (
    <div
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-[10px] border bg-gradient-to-b p-1.5 pl-2.5',
        'shadow-[0px_1px_3px_0px_rgba(10,13,18,0.06),0px_1px_2px_0px_rgba(10,13,18,0.02)]',
        surface,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn('flex size-[18px] shrink-0 items-center justify-center', iconColor)}>
          {icon ?? <Icon className="size-[18px]" />}
        </span>
        <span className="text-[14px] font-medium leading-[1.4] tracking-[0.3px] text-gray-900">
          {message}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex h-7 items-center rounded-[8px] border border-[#e8eaed] bg-white px-2.5 text-[13px] font-semibold tracking-[0.3px] text-[#2d3139] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] transition-colors hover:bg-gray-50"
          >
            {action.label}
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 shrink-0 items-center justify-center rounded-[8px] text-gray-500 transition-colors hover:bg-gray-900/[0.06] hover:text-gray-700"
          >
            <CrossIcon className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

const DEFAULT_OPTIONS: ExternalToast = {
  duration: 5000,
  className: 'custom-toast',
  /* The CustomToast card carries its own surface/border/shadow — keep the
     sonner wrapper transparent so the tint isn't double-painted. */
  style: {
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    padding: '0',
    width: '100%',
  },
};

/** Options accepted by the notification helpers — sonner options plus our extras. */
export type NotifyOptions = ExternalToast & { action?: ToastAction; icon?: ReactNode };

function show(type: ToastType, message: string, options?: NotifyOptions) {
  const { action, icon, ...rest } = options ?? {};
  return toast.custom(
    (id) => (
      <CustomToast
        type={type}
        message={message}
        icon={icon}
        action={
          action
            ? {
                label: action.label,
                onClick: () => {
                  action.onClick();
                  toast.dismiss(id);
                },
              }
            : undefined
        }
        onClose={() => toast.dismiss(id)}
      />
    ),
    { ...DEFAULT_OPTIONS, ...rest },
  );
}

export const notificationService = {
  success(message: string, options?: NotifyOptions) {
    return show('success', message, options);
  },

  error(message: string, options?: NotifyOptions) {
    return show('error', message, options);
  },

  info(message: string, options?: NotifyOptions) {
    return show('info', message, options);
  },
};

export { CustomToast };
export type { CustomToastProps, ToastType };
