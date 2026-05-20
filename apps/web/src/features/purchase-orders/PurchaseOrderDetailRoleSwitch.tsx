import { UserRole } from '@forethread/shared-types/client';
import { lazy, Suspense } from 'react';

import { RoleSwitch } from '@/shared/role';

const BuyerPurchaseOrderDetailPage = lazy(() => import('./buyer/pages/PurchaseOrderDetailPage'));
const VendorPurchaseOrderDetailPage = lazy(() => import('./vendor/pages/PurchaseOrderDetailPage'));

export default function PurchaseOrderDetailRoleSwitch() {
  return (
    <Suspense fallback={null}>
      <RoleSwitch
        byRole={{
          [UserRole.COMPANY_ADMIN]: <BuyerPurchaseOrderDetailPage />,
          [UserRole.PROCUREMENT_OFFICER]: <BuyerPurchaseOrderDetailPage />,
          [UserRole.VENDOR]: <VendorPurchaseOrderDetailPage />,
        }}
      />
    </Suspense>
  );
}
