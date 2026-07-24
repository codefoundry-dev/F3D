import { notificationStreamUrl, queryKeys } from '@forethread/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * Subscribe to the server's SSE notification stream. Each pushed notification
 * invalidates the feed + unread-count queries so the badge and panel update in
 * real time. EventSource reconnects automatically on transient errors; the slow
 * poll in {@link useUnreadNotificationCount} backs it up. Auth rides on the
 * session cookie via `withCredentials`.
 */
export function useNotificationStream(enabled: boolean): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') return;

    const source = new EventSource(notificationStreamUrl(), { withCredentials: true });

    const onNotification = () => {
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    };

    source.addEventListener('notification', onNotification);

    return () => {
      source.removeEventListener('notification', onNotification);
      source.close();
    };
  }, [enabled, qc]);
}
