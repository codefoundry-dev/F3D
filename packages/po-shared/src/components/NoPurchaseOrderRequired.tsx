import { useTranslation } from '@forethread/i18n';
import { Button, IconBadge } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';

interface NoPurchaseOrderRequiredProps {
  onClose: () => void;
}

export function NoPurchaseOrderRequired({ onClose }: NoPurchaseOrderRequiredProps) {
  const { t } = useTranslation('purchaseOrders');

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <IconBadge icon={<CheckCircleIcon className="w-6 h-6 text-foreground" />} className="mb-4" />
      <h2 className="text-xl font-semibold text-foreground mb-2">{t('noPoRequired.title')}</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
        {t('noPoRequired.description')}
      </p>
      <Button variant="primary" size="lg" onClick={onClose}>
        {t('noPoRequired.closePo')}
      </Button>
    </div>
  );
}
