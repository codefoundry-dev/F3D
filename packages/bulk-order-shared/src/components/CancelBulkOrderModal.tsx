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
            <h2 className="text-lg font-semibold text-foreground mt-4">{t('cancel.title')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('cancel.confirmMessage')}</p>
          </div>

          {mutation.isError && <Alert variant="destructive">{t('cancel.error')}</Alert>}

          <div className="flex flex-col gap-3 pt-2">
            <Button
              variant="destructive"
              isLoading={mutation.isPending}
              onClick={handleCancel}
              className="w-full"
            >
              {t('cancel.confirm')}
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
