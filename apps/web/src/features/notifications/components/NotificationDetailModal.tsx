import type { NotificationEntityType, NotificationItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@forethread/ui-components';

import { resolveNotificationLink } from '../services/notificationLink';

import { RelativeTime } from './RelativeTime';

/** Localized "View X" label for the deep-link button, by entity type. */
function useGoToLabel(entityType: NotificationEntityType | null): string {
  const { t } = useTranslation('notifications');
  switch (entityType) {
    case 'RFQ':
      return t('goTo.RFQ');
    case 'QUOTE_RESPONSE':
      return t('goTo.QUOTE_RESPONSE');
    case 'PURCHASE_ORDER':
      return t('goTo.PURCHASE_ORDER');
    case 'BULK_ORDER':
      return t('goTo.BULK_ORDER');
    case 'INVOICE':
      return t('goTo.INVOICE');
    default:
      return t('goTo.default');
  }
}

export interface NotificationDetailModalProps {
  notification: NotificationItem;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export function NotificationDetailModal({
  notification,
  onClose,
  onNavigate,
}: NotificationDetailModalProps) {
  const { t } = useTranslation('notifications');
  const link = resolveNotificationLink(notification);
  const goToLabel = useGoToLabel(notification.entityType);

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <ModalHeader onClose={onClose}>{notification.title}</ModalHeader>
      <ModalBody>
        {notification.sender && (
          <p className="mb-2 text-xs font-medium text-card-foreground/80">
            {t('from', { sender: notification.sender })}
          </p>
        )}
        {notification.body && (
          <p className="whitespace-pre-line text-sm text-muted-foreground">{notification.body}</p>
        )}
        <p className="mt-4 text-xs text-gray-400">
          <RelativeTime iso={notification.createdAt} />
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          {t('close')}
        </Button>
        {link && (
          <Button variant="primary" onClick={() => onNavigate(link)}>
            {goToLabel}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
