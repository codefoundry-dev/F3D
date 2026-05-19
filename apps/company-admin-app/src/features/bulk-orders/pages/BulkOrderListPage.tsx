import { BulkOrderListPage as SharedBulkOrderListPage } from '@forethread/bulk-order-shared';
import type { FilterDropdownOption } from '@forethread/ui-components';
import { useMemo } from 'react';

import { useCompanyVendors } from '../../purchase-orders/services/purchase-orders.service';

export default function BulkOrderListPage() {
  const { data: vendors } = useCompanyVendors();

  const vendorOptions: FilterDropdownOption[] = useMemo(
    () => (vendors ?? []).map((v) => ({ value: v.id, label: v.legalName })),
    [vendors],
  );

  return <SharedBulkOrderListPage counterpartyType="vendor" counterpartyOptions={vendorOptions} />;
}
