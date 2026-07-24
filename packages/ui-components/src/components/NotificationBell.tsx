import { type ButtonHTMLAttributes } from 'react';

import NotificationIcon from '../assets/icons/notification.svg?react';
import { cn } from '../utils/cn';

export interface NotificationBellProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Show a plain red dot (unread present, count unknown). Ignored when `count > 0`. */
  hasNotifications?: boolean;
  /** Unread count. When > 0 a numeric badge is shown (capped at "99+"). */
  count?: number;
}

export function NotificationBell({
  hasNotifications = false,
  count = 0,
  className,
  ...props
}: NotificationBellProps) {
  return (
    <button
      type="button"
      className={cn(
        'relative flex items-center justify-center w-10 h-10 rounded-xl border border-[rgba(19,19,19,0.2)] text-muted-foreground hover:text-foreground transition-colors',
        className,
      )}
      {...props}
    >
      <NotificationIcon className="w-[18px] h-[18px]" />
      {count > 0 ? (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white">
          {count > 99 ? '99+' : count}
        </span>
      ) : hasNotifications ? (
        <span className="absolute -top-px -right-px w-2 h-2 rounded-full bg-destructive" />
      ) : null}
    </button>
  );
}
