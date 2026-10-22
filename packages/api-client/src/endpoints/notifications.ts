import { getApiClient } from '../client';

import { NOTIFICATIONS_PATHS } from './paths';

// ── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'RFQ_RECEIVED'
  // Buyer-side mirror of the send (FOR-351): project members are told the RFQ
  // went out to vendors. Deep-links to the RFQ via entityType/entityId.
  | 'RFQ_SENT'
  | 'QUOTE_SUBMITTED'
  | 'QUOTE_UPDATED'
  | 'PO_ISSUED'
  | 'PO_PENDING_APPROVAL'
  | 'PO_APPROVAL_UNROUTABLE'
  | 'PO_DECLINED'
  // The CHANGE_REQUEST_* trio covers both bulk-agreement and PO change requests
  // — `entityType` is what tells them apart.
  | 'CHANGE_REQUEST_PROPOSED'
  | 'CHANGE_REQUEST_APPROVED'
  | 'CHANGE_REQUEST_REJECTED'
  | 'PO_INTERNAL_CHANGE'
  | 'BULK_ORDER_CANCELLED'
  | 'INVOICE_REJECTED'
  | 'INVOICE_PENDING_APPROVAL'
  | 'INVOICE_APPROVAL_UNROUTABLE'
  | 'MATERIAL_REQUEST_PENDING_APPROVAL'
  | 'MATERIAL_REQUEST_APPROVAL_UNROUTABLE'
  | 'PAYMENT_DUE'
  | 'PAYMENT_OVERDUE'
  | 'MESSAGE_RECEIVED';

export type NotificationEntityType =
  | 'RFQ'
  | 'QUOTE_RESPONSE'
  | 'PURCHASE_ORDER'
  | 'BULK_ORDER'
  | 'INVOICE'
  | 'MATERIAL_REQUEST';

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
  /**
   * Who it came from, formatted server-side (FOR-366): "{name} · {company}",
   * the company alone, or "Forethread" for system events. Null on rows that
   * predate the sender being recorded.
   */
  sender: string | null;
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
