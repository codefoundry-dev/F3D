import { getApiClient } from '../client';

import { NOTIFICATIONS_PATHS } from './paths';

// ── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'RFQ_RECEIVED'
  | 'QUOTE_SUBMITTED'
  | 'QUOTE_UPDATED'
  | 'PO_ISSUED'
  | 'PO_PENDING_APPROVAL'
  | 'PO_DECLINED'
  | 'CHANGE_REQUEST_PROPOSED'
  | 'CHANGE_REQUEST_APPROVED'
  | 'CHANGE_REQUEST_REJECTED'
  | 'BULK_ORDER_CANCELLED'
  | 'MESSAGE_RECEIVED';

export type NotificationEntityType = 'RFQ' | 'QUOTE_RESPONSE' | 'PURCHASE_ORDER' | 'BULK_ORDER';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  /** ISO timestamp, or null when unread. */
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unreadCount: number;
}

export interface PaginatedNotificationsResponse {
  items: NotificationItem[];
  meta: NotificationListMeta;
}

export interface ListNotificationsParams {
  page?: number;
  limit?: number;
  filter?: 'all' | 'unread';
}

// ── API Functions ────────────────────────────────────────────────────────────

export async function getNotifications(
  params?: ListNotificationsParams,
): Promise<PaginatedNotificationsResponse> {
  const { data } = await getApiClient().get<{ data: PaginatedNotificationsResponse }>(
    NOTIFICATIONS_PATHS.BASE,
    { params },
  );
  return data.data;
}

export async function getUnreadNotificationCount(): Promise<{ count: number }> {
  const { data } = await getApiClient().get<{ data: { count: number } }>(
    NOTIFICATIONS_PATHS.UNREAD_COUNT,
  );
  return data.data;
}

export async function markNotificationRead(id: string): Promise<{ updated: number }> {
  const { data } = await getApiClient().post<{ data: { updated: number } }>(
    NOTIFICATIONS_PATHS.markRead(id),
  );
  return data.data;
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  const { data } = await getApiClient().post<{ data: { updated: number } }>(
    NOTIFICATIONS_PATHS.READ_ALL,
  );
  return data.data;
}

/**
 * Absolute URL of the SSE stream, built from the configured API base URL so
 * `EventSource(url, { withCredentials: true })` hits the same origin as the REST
 * client (and sends the auth cookie with it).
 */
export function notificationStreamUrl(): string {
  const base = getApiClient().defaults.baseURL ?? '/v1';
  return `${base.replace(/\/$/, '')}${NOTIFICATIONS_PATHS.STREAM}`;
}
