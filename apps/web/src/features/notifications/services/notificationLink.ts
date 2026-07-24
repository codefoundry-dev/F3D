import type { NotificationItem } from '@forethread/api-client';
import { generatePath } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

/**
 * Resolve a notification's deep-link path from its entity target. Routes are
 * canonical (a single URL renders the buyer or vendor page via RoleSwitch), so
 * this is role-independent. Returns null when the notification has no navigable
 * target (e.g. a message on a context type without an app route).
 */
export function resolveNotificationLink(notification: NotificationItem): string | null {
  const { entityType, entityId, metadata } = notification;
  if (!entityType || !entityId) return null;

  switch (entityType) {
    case 'RFQ':
      return generatePath(ROUTES.rfqDetail, { id: entityId });
    case 'PURCHASE_ORDER':
      return generatePath(ROUTES.purchaseOrderDetail, { id: entityId });
    case 'BULK_ORDER':
      return generatePath(ROUTES.bulkOrderDetail, { id: entityId });
    case 'QUOTE_RESPONSE': {
      const rfqId = typeof metadata?.rfqId === 'string' ? metadata.rfqId : null;
      if (!rfqId) return null;
      return generatePath(ROUTES.quoteResponseDetail, { id: rfqId, quoteId: entityId });
    }
    default:
      return null;
  }
}
