import { useTranslation } from '@forethread/i18n';
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  Button,
  Alert,
  IconBadge,
} from '@forethread/ui-components';
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
    <Modal onClose={onClose} maxWidth="max-w-[560px]">
      <ModalBody>
        <div className="space-y-5">
          <div className="flex flex-col items-center text-center mb-2">
            <div className="w-full flex justify-between items-start">
              <div className="flex-1" />
              <IconBadge icon={<DeleteIcon className="w-6 h-6 text-foreground" />} />
              <div className="flex-1 flex justify-end">
                <ModalCloseButton onClose={onClose} />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-foreground mt-4">
              {t('modals.deleteConfirmTitle')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{t('modals.deleteConfirmMessage')}</p>
          </div>

          {mutation.isError && <Alert variant="destructive">{t('modals.deleteError')}</Alert>}

          <div className="flex flex-col gap-3 pt-2">
            <Button
              variant="destructive"
              isLoading={mutation.isPending}
              onClick={handleDelete}
              className="w-full"
            >
              {t('modals.confirmDelete')}
            </Button>
            <Button variant="outline" onClick={onClose} className="w-full">
              {t('modals.cancel')}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
