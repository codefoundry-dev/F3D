import { useTranslation } from '@forethread/i18n';
import { Button, Modal, ModalIconHeader, formatCurrency } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';

interface BulkPriceWarningModalProps {
  open: boolean;
  onClose: () => void;
  bulkPrice: number;
  enteredPrice: number;
  onUseBulkPrice: () => void;
  onKeepCustomPrice: () => void;
}

export function BulkPriceWarningModal({
  open,
  onClose,
  bulkPrice,
  enteredPrice,
  onUseBulkPrice,
  onKeepCustomPrice,
}: BulkPriceWarningModalProps) {
  const { t } = useTranslation('purchaseOrders');

  if (!open) return null;

  return (
    <Modal onClose={onClose} maxWidth="max-w-[560px]">
      <div className="p-8 flex flex-col">
        <ModalIconHeader
          icon={<CheckCircleIcon className="w-6 h-6 text-foreground" />}
          title={t('bulkPriceWarning.title')}
          onClose={onClose}
          className="mb-4"
        />
        <div className="text-sm text-muted-foreground text-center space-y-3 mb-8">
          <p>
            {t('bulkPriceWarning.descriptionLine1')}{' '}
            <span className="font-semibold text-foreground">{formatCurrency(bulkPrice)}</span>
            {t('bulkPriceWarning.descriptionLine2')}{' '}
            <span className="font-medium text-foreground">{formatCurrency(enteredPrice)}</span>.
          </p>
          <p>{t('bulkPriceWarning.descriptionWarning')}</p>
        </div>

        <div className="flex flex-col gap-4">
          <Button variant="primary" size="lg" onClick={onUseBulkPrice} className="w-full">
            {t('bulkPriceWarning.useBulkPrice')}
          </Button>
          <Button variant="outline" size="lg" onClick={onKeepCustomPrice} className="w-full">
            {t('bulkPriceWarning.keepCustomPrice')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
