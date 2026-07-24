import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  queryKeys,
  type ListNotificationsParams,
  type PaginatedNotificationsResponse,
} from '@forethread/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Slow poll of the unread count as a safety net behind the SSE stream — covers
 * a dropped connection or (if the backend is ever multi-instance) a push that
 * landed on another node. Refetches on window focus too.
 */
const UNREAD_POLL_MS = 60_000;

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: getUnreadNotificationCount,
    refetchInterval: UNREAD_POLL_MS,
    refetchOnWindowFocus: true,
    select: (data) => data.count,
  });
}

/** Fetch the feed. Enabled only while the panel is open to avoid idle traffic. */
export function useNotificationsFeed(params: ListNotificationsParams, enabled: boolean) {
  return useQuery<PaginatedNotificationsResponse>({
    queryKey: queryKeys.notifications.list(params as Record<string, unknown>),
    queryFn: () => getNotifications(params),
    enabled,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}
