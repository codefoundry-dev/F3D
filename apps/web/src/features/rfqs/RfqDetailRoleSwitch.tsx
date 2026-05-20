import { UserRole } from '@forethread/shared-types';
import { lazy, Suspense } from 'react';

import { RoleSwitch } from '@/shared/role';

const BuyerRfqDetailPage = lazy(() => import('./buyer/pages/RfqDetailPage'));
const VendorRfqDetailPage = lazy(() => import('./vendor/pages/RfqDetailPage'));

export default function RfqDetailRoleSwitch() {
  return (
    <Suspense fallback={null}>
      <RoleSwitch
        byRole={{
          [UserRole.COMPANY_ADMIN]: <BuyerRfqDetailPage />,
          [UserRole.PROCUREMENT_OFFICER]: <BuyerRfqDetailPage />,
          [UserRole.VENDOR]: <VendorRfqDetailPage />,
        }}
      />
    </Suspense>
  );
}
