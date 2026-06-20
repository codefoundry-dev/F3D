import { toast, type ExternalToast } from 'sonner';

import CheckCircleIcon from '../assets/icons/checkcircle-icon.svg?react';
import CrossInCircleIcon from '../assets/icons/cross-in-circle.svg?react';
import CrossIcon from '../assets/icons/cross.svg?react';
import InfoIcon from '../assets/icons/info.svg?react';
import { cn } from '../utils/cn';

type ToastType = 'success' | 'error' | 'info';

interface CustomToastProps {
  type: ToastType;
  message: string;
  onClose?: () => void;
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

function CustomToast({ type, message, onClose }: CustomToastProps) {
  const { Icon, surface, icon } = typeStyles[type];

  return (
    <div
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-[10px] border bg-gradient-to-b p-1.5 pl-2.5',
        'shadow-[0px_1px_3px_0px_rgba(10,13,18,0.06),0px_1px_2px_0px_rgba(10,13,18,0.02)]',
        surface,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn('flex size-[18px] shrink-0 items-center justify-center', icon)}>
          <Icon className="size-[18px]" />
        </span>
        <span className="text-[14px] font-medium leading-[1.4] tracking-[0.3px] text-gray-900">
          {message}
        </span>
      </div>
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

export const notificationService = {
  success(message: string, options?: ExternalToast) {
    return toast.custom(
      (id) => <CustomToast type="success" message={message} onClose={() => toast.dismiss(id)} />,
      { ...DEFAULT_OPTIONS, ...options },
    );
  },

  error(message: string, options?: ExternalToast) {
    return toast.custom(
      (id) => <CustomToast type="error" message={message} onClose={() => toast.dismiss(id)} />,
      { ...DEFAULT_OPTIONS, ...options },
    );
  },

  info(message: string, options?: ExternalToast) {
    return toast.custom(
      (id) => <CustomToast type="info" message={message} onClose={() => toast.dismiss(id)} />,
      { ...DEFAULT_OPTIONS, ...options },
    );
  },
};

export { CustomToast };
export type { CustomToastProps, ToastType };
