import { BulkOrderDetailPage as SharedBulkOrderDetailPage } from '@forethread/bulk-order-shared';
import { useTranslation } from '@forethread/i18n';

import { useAuthStore } from '@/features/auth/state/auth.store';

export default function BulkOrderDetailPage() {
  const { t } = useTranslation('bulkOrders');
  const currentUserId = useAuthStore((s) => s.currentUser?.id);

  return (
    <SharedBulkOrderDetailPage
      counterpartyLabel={t('detail.contractorName')}
      showDrawdown={false}
      showChangeActions
      isVendorView
      currentUserId={currentUserId}
    />
  );
}
