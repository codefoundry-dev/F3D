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

/** Per-type DS status icon + colour (Figma Toast 3719-72068). */
const typeStyles: Record<ToastType, { Icon: typeof InfoIcon; icon: string }> = {
  success: { Icon: CheckCircleIcon, icon: 'text-green-600' },
  error: { Icon: CrossInCircleIcon, icon: 'text-destructive-600' },
  info: { Icon: InfoIcon, icon: 'text-blue-600' },
};

function CustomToast({ type, message, onClose }: CustomToastProps) {
  const styles = typeStyles[type];
  const Icon = styles.Icon;

  return (
    <div className="flex w-full items-center justify-between gap-3 px-3 py-2">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-4 w-4 flex-shrink-0 items-center justify-center', styles.icon)}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium leading-[140%] text-gray-900">{message}</span>
      </div>
      {onClose && (
        <div className="flex items-center gap-3">
          <div className="w-px h-4 bg-border" />
          <button
            type="button"
            onClick={onClose}
            className="text-foreground hover:opacity-70 transition-opacity"
            aria-label="Close"
          >
            <CrossIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

const DEFAULT_OPTIONS: ExternalToast = {
  duration: 5000,
  className: 'custom-toast',
  style: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 'var(--radius)',
    padding: '0',
    boxShadow: 'var(--shadow-sm)',
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
