import { UserRole } from '@forethread/shared-types/client';
import { lazy, Suspense } from 'react';

import { RoleSwitch } from '@/shared/role';

const BuyerBulkOrderReviewChangePage = lazy(
  () => import('./buyer/pages/BulkOrderReviewChangePage'),
);
const VendorBulkOrderReviewChangePage = lazy(
  () => import('./vendor/pages/BulkOrderReviewChangePage'),
);

export default function BulkOrderReviewChangeRoleSwitch() {
  return (
    <Suspense fallback={null}>
      <RoleSwitch
        byRole={{
          [UserRole.COMPANY_ADMIN]: <BuyerBulkOrderReviewChangePage />,
          [UserRole.PROCUREMENT_OFFICER]: <BuyerBulkOrderReviewChangePage />,
          [UserRole.VENDOR]: <VendorBulkOrderReviewChangePage />,
        }}
      />
    </Suspense>
  );
}
