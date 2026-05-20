import { UserRole } from '@forethread/shared-types';
import { lazy, Suspense } from 'react';

import { RoleSwitch } from '@/shared/role';

const BuyerBulkOrderListPage = lazy(() => import('./buyer/pages/BulkOrderListPage'));
const VendorBulkOrderListPage = lazy(() => import('./vendor/pages/BulkOrderListPage'));

export default function BulkOrderListRoleSwitch() {
  return (
    <Suspense fallback={null}>
      <RoleSwitch
        byRole={{
          [UserRole.COMPANY_ADMIN]: <BuyerBulkOrderListPage />,
          [UserRole.PROCUREMENT_OFFICER]: <BuyerBulkOrderListPage />,
          [UserRole.VENDOR]: <VendorBulkOrderListPage />,
        }}
      />
    </Suspense>
  );
}
