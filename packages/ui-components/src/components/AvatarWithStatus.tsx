import { cn } from '../utils/cn';

export type WorkStatusType = 'available' | 'unavailable' | 'onLeave' | null | undefined;

export interface AvatarWithStatusProps {
  name: string;
  avatarUrl?: string | null;
  workStatus?: WorkStatusType;
  /** Avatar size in px — default 32 */
  size?: number;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-[#16B364] border-[#087443]',
  unavailable: 'bg-[#999FAD] border-[#6D7588]',
  onLeave: 'bg-[#F79009] border-[#DC6803]',
};

/**
 * Avatar with an optional work-status indicator dot (bottom-right).
 * Matches Figma "Online indicator" specs (8px dot, 1.5px white border, rounded-[4px]).
 */
export function AvatarWithStatus({
  name,
  avatarUrl,
  workStatus,
  size = 32,
  className,
}: AvatarWithStatusProps) {
  const initial = name?.charAt(0).toUpperCase() ?? '?';
  const statusColor = workStatus ? STATUS_COLORS[workStatus] : null;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="rounded-full object-cover border border-white"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium text-xs border border-white"
          style={{ width: size, height: size, fontSize: size * 0.375 }}
        >
          {initial}
        </div>
      )}

      {statusColor && (
        <span
          className={cn(
            'absolute bottom-0 right-0 w-2 h-2 rounded-[4px] border-[1.5px] border-white shadow-[0px_1px_6px_0px_rgba(10,13,18,0.1),0px_1px_2px_0px_rgba(10,13,18,0.06)]',
            statusColor,
          )}
        />
      )}
    </div>
  );
}
