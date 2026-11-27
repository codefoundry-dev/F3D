import type { NotificationItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Modal, NotificationBell, useDropdown, useIsPhone } from '@forethread/ui-components';
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
 * document. New notifications arrive live over SSE. On phones the panel opens
 * as a full-width bottom sheet instead of a dropdown anchored to the bell, which
 * would overflow the screen's left edge (FOR-379).
 */
export function NotificationCenter() {
  const { t } = useTranslation('notifications');
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const dropdown = useDropdown();
  // The sheet portals to <body>, so the dropdown's click-outside would close it
  // on the first tap inside; phones keep their own open state.
  const [sheetOpen, setSheetOpen] = useState(false);
  const isOpen = isPhone ? sheetOpen : dropdown.isOpen;
  const setIsOpen = isPhone ? setSheetOpen : dropdown.setIsOpen;

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
    void navigate(path);
  };

  const panelProps = {
    items: feed.data?.items ?? [],
    isLoading: feed.isLoading,
    unreadCount,
    onSelect: handleSelect,
    onMarkAll: () => markAll.mutate(),
    markAllPending: markAll.isPending,
  };

  return (
    <div ref={dropdown.ref} className="relative">
      <NotificationBell
        aria-label={t('ariaBell')}
        count={unreadCount}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      />

      {isOpen &&
        (isPhone ? (
          <Modal onClose={() => setIsOpen(false)} mobile="sheet">
            <NotificationPanel
              {...panelProps}
              className="max-h-[80dvh] w-full max-w-none rounded-none border-0 shadow-none"
            />
          </Modal>
        ) : (
          <div className="absolute right-0 top-full z-50 mt-2">
            <NotificationPanel {...panelProps} />
          </div>
        ))}

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
