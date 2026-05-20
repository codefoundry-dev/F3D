import { UserRole } from '@forethread/shared-types';
import { lazy, Suspense } from 'react';

import { RoleSwitch } from '@/shared/role';

const BuyerRfqListPage = lazy(() => import('./buyer/pages/RfqListPage'));
const VendorRfqListPage = lazy(() => import('./vendor/pages/RfqListPage'));

export default function RfqListRoleSwitch() {
  return (
    <Suspense fallback={null}>
      <RoleSwitch
        byRole={{
          [UserRole.COMPANY_ADMIN]: <BuyerRfqListPage />,
          [UserRole.PROCUREMENT_OFFICER]: <BuyerRfqListPage />,
          [UserRole.VENDOR]: <VendorRfqListPage />,
        }}
      />
    </Suspense>
  );
}
