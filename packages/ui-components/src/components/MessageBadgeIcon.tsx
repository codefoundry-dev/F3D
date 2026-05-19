import MessageIcon from '../assets/icons/message.svg?react';
import { cn } from '../utils/cn';

export interface MessageBadgeIconProps {
  hasNotification?: boolean;
  className?: string;
  iconClassName?: string;
  onClick?: () => void;
  /** Custom icon to render instead of the default MessageIcon */
  icon?: React.ReactNode;
}

export function MessageBadgeIcon({
  hasNotification = false,
  className,
  iconClassName,
  onClick,
  icon,
}: MessageBadgeIconProps) {
  const Tag = onClick ? 'button' : 'span';

  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
        className,
      )}
    >
      <span className="relative inline-block">
        {icon ?? <MessageIcon className={cn('w-4 h-4 block', iconClassName)} />}

        {hasNotification && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-destructive" />
        )}
      </span>
    </Tag>
  );
}
