import { useTranslation } from '@forethread/i18n';
import { usePurchaseOrder } from '@forethread/po-shared';
import { Spinner } from '@forethread/ui-components';
import { useParams } from 'react-router-dom';

export default function ChangeRequestPage() {
  const { t } = useTranslation('purchaseOrders');
  const { id } = useParams<{ id: string }>();
  const { data: po, isLoading } = usePurchaseOrder(id ?? '');

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">{t('detail.noData')}</div>
    );
  }

  return (
    <div className="px-4 md:px-8 pt-4 md:pt-6 pb-6 md:pb-8">
      <h1 className="text-xl font-semibold text-foreground mb-6">
        {t('changeRequest.title', 'Change Request')} — {po.projectName}
      </h1>
      <p className="text-muted-foreground">
        {t('changeRequest.placeholder', 'Change request functionality coming soon.')}
      </p>
    </div>
  );
}
