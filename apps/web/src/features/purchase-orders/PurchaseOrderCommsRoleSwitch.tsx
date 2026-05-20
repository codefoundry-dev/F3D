import { UserRole } from '@forethread/shared-types/client';
import { lazy, Suspense } from 'react';

import { RoleSwitch } from '@/shared/role';

const BuyerPurchaseOrderCommsPage = lazy(() => import('./buyer/pages/PurchaseOrderCommsPage'));
const VendorPurchaseOrderCommsPage = lazy(() => import('./vendor/pages/PurchaseOrderCommsPage'));

export default function PurchaseOrderCommsRoleSwitch() {
  return (
    <Suspense fallback={null}>
      <RoleSwitch
        byRole={{
          [UserRole.COMPANY_ADMIN]: <BuyerPurchaseOrderCommsPage />,
          [UserRole.PROCUREMENT_OFFICER]: <BuyerPurchaseOrderCommsPage />,
          [UserRole.VENDOR]: <VendorPurchaseOrderCommsPage />,
        }}
      />
    </Suspense>
  );
}
