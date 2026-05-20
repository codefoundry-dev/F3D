import { UserRole } from '@forethread/shared-types/client';
import { lazy, Suspense } from 'react';

import { RoleSwitch } from '@/shared/role';

const BuyerBulkOrderChangePage = lazy(() => import('./buyer/pages/BulkOrderChangePage'));
const VendorBulkOrderChangePage = lazy(() => import('./vendor/pages/BulkOrderChangePage'));

export default function BulkOrderChangeRoleSwitch() {
  return (
    <Suspense fallback={null}>
      <RoleSwitch
        byRole={{
          [UserRole.COMPANY_ADMIN]: <BuyerBulkOrderChangePage />,
          [UserRole.PROCUREMENT_OFFICER]: <BuyerBulkOrderChangePage />,
          [UserRole.VENDOR]: <VendorBulkOrderChangePage />,
        }}
      />
    </Suspense>
  );
}
