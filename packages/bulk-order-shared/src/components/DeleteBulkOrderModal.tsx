import { useTranslation } from '@forethread/i18n';
import { GridModal, Button, Alert } from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';

import { useDeleteBulkOrder } from '../services/bulk-orders.service';

export interface DeleteBulkOrderModalProps {
  bulkOrderId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DeleteBulkOrderModal({
  bulkOrderId,
  onClose,
  onSuccess,
}: DeleteBulkOrderModalProps) {
  const { t } = useTranslation(['bulkOrders', 'common']);
  const mutation = useDeleteBulkOrder();

  const handleDelete = () => {
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
      title={t('modals.deleteConfirmTitle')}
      description={t('modals.deleteConfirmMessage')}
      actions={
        <>
          <Button
            variant="destructive"
            size="lg"
            isLoading={mutation.isPending}
            onClick={handleDelete}
            className="w-full"
          >
            {t('modals.confirmDelete')}
          </Button>
          <Button variant="outline" size="lg" onClick={onClose} className="w-full">
            {t('modals.cancel')}
          </Button>
        </>
      }
    >
      {mutation.isError && <Alert variant="destructive">{t('modals.deleteError')}</Alert>}
    </GridModal>
  );
}
