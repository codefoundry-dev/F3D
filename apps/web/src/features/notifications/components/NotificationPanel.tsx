import type { NotificationItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { cn } from '@forethread/ui-components';

import { RelativeTime } from './RelativeTime';

export interface NotificationPanelProps {
  items: NotificationItem[];
  isLoading: boolean;
  unreadCount: number;
  onSelect: (notification: NotificationItem) => void;
  onMarkAll: () => void;
  markAllPending: boolean;
  /** Overrides the dropdown chrome (the phone bottom sheet drops it). */
  className?: string;
}

export function NotificationPanel({
  items,
  isLoading,
  unreadCount,
  onSelect,
  onMarkAll,
  markAllPending,
  className,
}: NotificationPanelProps) {
  const { t } = useTranslation('notifications');

  return (
    <div
      className={cn(
        'flex max-h-[70vh] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-card-foreground">{t('title')}</h2>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAll}
            disabled={markAllPending}
            className="text-xs font-medium text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
          >
            {t('markAllRead')}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">{t('loading')}</p>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-card-foreground">{t('empty')}</p>
            <p className="mt-1 text-xs text-gray-400">{t('emptyHint')}</p>
          </div>
        ) : (
          <ul>
            {items.map((n) => {
              const unread = !n.readAt;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(n)}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50',
                      unread && 'bg-primary/[0.03]',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        unread ? 'bg-destructive' : 'bg-transparent',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-sm text-card-foreground',
                          unread ? 'font-semibold' : 'font-medium',
                        )}
                      >
                        {n.title}
                      </span>
                      {n.sender && (
                        <span className="mt-0.5 block truncate text-xs font-medium text-card-foreground/80">
                          {n.sender}
                        </span>
                      )}
                      {n.body && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                          {n.body}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px] text-gray-400">
                        <RelativeTime iso={n.createdAt} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
