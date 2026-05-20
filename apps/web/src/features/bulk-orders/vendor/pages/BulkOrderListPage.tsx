import { BulkOrderListPage as SharedBulkOrderListPage } from '@forethread/bulk-order-shared';
import { useTranslation } from '@forethread/i18n';

export default function BulkOrderListPage() {
  const { t } = useTranslation('bulkOrders');

  return (
    <SharedBulkOrderListPage
      counterpartyFilterLabel={t('list.allContractors')}
      counterpartyPopoverTitle={t('filters.contractorsTitle')}
      counterpartyColumnKey="contractorName"
      counterpartyType="contractor"
      hideCreate
      isVendorView
    />
  );
}
