import { UserRole } from '@forethread/shared-types/client';
import { lazy, Suspense } from 'react';

import { RoleSwitch } from '@/shared/role';

const BuyerBulkOrderDetailPage = lazy(() => import('./buyer/pages/BulkOrderDetailPage'));
const VendorBulkOrderDetailPage = lazy(() => import('./vendor/pages/BulkOrderDetailPage'));

export default function BulkOrderDetailRoleSwitch() {
  return (
    <Suspense fallback={null}>
      <RoleSwitch
        byRole={{
          [UserRole.COMPANY_ADMIN]: <BuyerBulkOrderDetailPage />,
          [UserRole.PROCUREMENT_OFFICER]: <BuyerBulkOrderDetailPage />,
          [UserRole.VENDOR]: <VendorBulkOrderDetailPage />,
        }}
      />
    </Suspense>
  );
}
