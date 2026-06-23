import { useTranslation } from '@forethread/i18n';
import { Button, GridModal, formatCurrency } from '@forethread/ui-components';
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
    <GridModal
      onClose={onClose}
      icon={<CheckCircleIcon className="size-6 text-gray-700" />}
      title={t('bulkPriceWarning.title')}
      actions={
        <>
          <Button variant="primary" size="lg" onClick={onUseBulkPrice} className="w-full">
            {t('bulkPriceWarning.useBulkPrice')}
          </Button>
          <Button variant="outline" size="lg" onClick={onKeepCustomPrice} className="w-full">
            {t('bulkPriceWarning.keepCustomPrice')}
          </Button>
        </>
      }
    >
      <div className="text-sm text-muted-foreground text-center space-y-3">
        <p>
          {t('bulkPriceWarning.descriptionLine1')}{' '}
          <span className="font-semibold text-foreground">{formatCurrency(bulkPrice)}</span>
          {t('bulkPriceWarning.descriptionLine2')}{' '}
          <span className="font-medium text-foreground">{formatCurrency(enteredPrice)}</span>.
        </p>
        <p>{t('bulkPriceWarning.descriptionWarning')}</p>
      </div>
    </GridModal>
  );
}
