import { UserRole } from '@forethread/shared-types';
import { lazy, Suspense } from 'react';

import { RoleSwitch } from '@/shared/role';

const BuyerPurchaseOrderListPage = lazy(() => import('./buyer/pages/PurchaseOrderListPage'));
const VendorPurchaseOrderListPage = lazy(() => import('./vendor/pages/PurchaseOrderListPage'));

export default function PurchaseOrderListRoleSwitch() {
  return (
    <Suspense fallback={null}>
      <RoleSwitch
        byRole={{
          [UserRole.COMPANY_ADMIN]: <BuyerPurchaseOrderListPage />,
          [UserRole.PROCUREMENT_OFFICER]: <BuyerPurchaseOrderListPage />,
          [UserRole.VENDOR]: <VendorPurchaseOrderListPage />,
        }}
      />
    </Suspense>
  );
}
