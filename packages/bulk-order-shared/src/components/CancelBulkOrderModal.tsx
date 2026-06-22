import { useTranslation } from '@forethread/i18n';
import { GridModal, Button, Alert } from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';

import { useCancelBulkOrder } from '../services/bulk-orders.service';

export interface CancelBulkOrderModalProps {
  bulkOrderId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CancelBulkOrderModal({
  bulkOrderId,
  onClose,
  onSuccess,
}: CancelBulkOrderModalProps) {
  const { t: _t } = useTranslation(['bulkOrders', 'common']);
  const t = _t as (key: string, opts?: Record<string, unknown>) => string;
  const mutation = useCancelBulkOrder();

  const handleCancel = () => {
    mutation.mutate(bulkOrderId, {
      onSuccess: () => {
        onSuccess?.();
        onClose();
      },
    });
  };

  return (
    <GridModal
      onClose={onClose}
      icon={<DeleteIcon className="size-6 text-destructive" />}
      title={t('cancel.title')}
      description={t('cancel.confirmMessage')}
      actions={
        <>
          <Button
            variant="destructive"
            size="lg"
            isLoading={mutation.isPending}
            onClick={handleCancel}
            className="w-full"
          >
            {t('cancel.confirm')}
          </Button>
          <Button variant="outline" size="lg" onClick={onClose} className="w-full">
            {t('modals.cancel')}
          </Button>
        </>
      }
    >
      {mutation.isError && <Alert variant="destructive">{t('cancel.error')}</Alert>}
    </GridModal>
  );
}
