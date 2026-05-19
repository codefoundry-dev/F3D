import { toast, type ExternalToast } from 'sonner';

import CrossIcon from '../assets/icons/cross.svg?react';
import InfoIcon from '../assets/icons/info.svg?react';
import { cn } from '../utils/cn';

type ToastType = 'success' | 'error' | 'info';

interface CustomToastProps {
  type: ToastType;
  message: string;
  onClose?: () => void;
}

const typeStyles: Record<ToastType, { icon: string; text: string }> = {
  success: { icon: 'text-foreground', text: 'text-foreground' },
  error: { icon: 'text-destructive', text: 'text-foreground' },
  info: { icon: 'text-foreground', text: 'text-foreground' },
};

function CustomToast({ type, message, onClose }: CustomToastProps) {
  const styles = typeStyles[type];

  return (
    <div className="flex items-center justify-between w-full gap-3 py-2 px-3">
      <div className="flex items-center gap-3">
        <div className={cn('w-4 h-4 flex-shrink-0 flex items-center justify-center', styles.icon)}>
          <InfoIcon className="w-4 h-4" />
        </div>
        <span className={cn('text-sm font-normal leading-[140%]', styles.text)}>{message}</span>
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
