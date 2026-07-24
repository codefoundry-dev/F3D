import type { NotificationItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { NotificationBell, useDropdown } from '@forethread/ui-components';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsFeed,
  useUnreadNotificationCount,
} from '../hooks/useNotifications';
import { useNotificationStream } from '../hooks/useNotificationStream';

import { NotificationDetailModal } from './NotificationDetailModal';
import { NotificationPanel } from './NotificationPanel';

const FEED_PARAMS = { limit: 15 } as const;

/**
 * Header notification centre: the bell (with unread badge), a dropdown panel of
 * recent notifications, and a detail modal that deep-links to the underlying
 * document. New notifications arrive live over SSE.
 */
export function NotificationCenter() {
  const { t } = useTranslation('notifications');
  const navigate = useNavigate();
  const { isOpen, setIsOpen, ref } = useDropdown();

  useNotificationStream(true);

  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const feed = useNotificationsFeed(FEED_PARAMS, isOpen);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const [selected, setSelected] = useState<NotificationItem | null>(null);

  const handleSelect = (notification: NotificationItem) => {
    if (!notification.readAt) markRead.mutate(notification.id);
    setSelected(notification);
    setIsOpen(false);
  };

  const handleNavigate = (path: string) => {
    setSelected(null);
    navigate(path);
  };

  return (
    <div ref={ref} className="relative">
      <NotificationBell
        aria-label={t('ariaBell')}
        count={unreadCount}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      />

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2">
          <NotificationPanel
            items={feed.data?.items ?? []}
            isLoading={feed.isLoading}
            unreadCount={unreadCount}
            onSelect={handleSelect}
            onMarkAll={() => markAll.mutate()}
            markAllPending={markAll.isPending}
          />
        </div>
      )}

      {selected && (
        <NotificationDetailModal
          notification={selected}
          onClose={() => setSelected(null)}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}
