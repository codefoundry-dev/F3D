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
        'relative flex items-center justify-center w-[34px] h-[34px] rounded-lg border border-[#E8EAED] text-muted-foreground hover:text-foreground transition-colors',
        className,
      )}
      {...props}
    >
      <NotificationIcon className="w-[18px] h-[18px]" />
      {hasNotifications && (
        <span className="absolute -top-[1px] right-0 w-2 h-2 rounded-[4px] bg-[#2E90FA] border border-[#175CD3]" />
      )}
    </button>
  );
}
