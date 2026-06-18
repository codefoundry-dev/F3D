import { type ButtonHTMLAttributes } from 'react';

import NotificationIcon from '../assets/icons/notification.svg?react';
import { cn } from '../utils/cn';

export interface NotificationBellProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  hasNotifications?: boolean;
}

export function NotificationBell({
  hasNotifications = false,
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
      {hasNotifications && (
        <span className="absolute -top-px -right-px w-2 h-2 rounded-full bg-destructive" />
      )}
    </button>
  );
}
