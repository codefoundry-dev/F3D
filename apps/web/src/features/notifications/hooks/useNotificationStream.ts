import { notificationStreamUrl, queryKeys } from '@forethread/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/** Payload of an SSE `message` event: a chat thread the user is on changed. */
interface MessageActivity {
  threadId: string;
  contextType: string;
  contextId: string;
}

function parseMessageActivity(raw: unknown): MessageActivity | null {
  if (typeof raw !== 'string') return null;
  try {
    const data = JSON.parse(raw) as Partial<MessageActivity>;
    if (typeof data.threadId !== 'string') return null;
    return {
      threadId: data.threadId,
      contextType: String(data.contextType ?? ''),
      contextId: String(data.contextId ?? ''),
    };
  } catch {
    return null;
  }
}

/**
 * Subscribe to the server's SSE stream. Each pushed notification invalidates the
 * feed + unread-count queries so the badge and panel update in real time. Each
 * `message` event refetches that chat thread — the query keys match
 * `useMessageThread` in rfq-shared — so an open conversation shows the other
 * party's message instantly instead of on its next poll. The thread list is
 * refetched too, so the first message of a brand-new thread appears on the
 * other side. EventSource reconnects automatically on transient errors; the
 * polls in {@link useUnreadNotificationCount} and `useMessageThread` back it up.
 * Auth rides on the session cookie via `withCredentials`.
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

    const onMessage = (event: Event) => {
      const activity = parseMessageActivity((event as MessageEvent).data);
      if (!activity) return;
      void qc.invalidateQueries({ queryKey: ['messages', activity.threadId] });
      void qc.invalidateQueries({
        queryKey: ['message-threads', activity.contextType, activity.contextId],
      });
    };

    source.addEventListener('notification', onNotification);
    source.addEventListener('message', onMessage);

    return () => {
      source.removeEventListener('notification', onNotification);
      source.removeEventListener('message', onMessage);
      source.close();
    };
  }, [enabled, qc]);
}
