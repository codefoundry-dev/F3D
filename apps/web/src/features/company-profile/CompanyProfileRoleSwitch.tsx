import { UserRole } from '@forethread/shared-types/client';
import { lazy, Suspense } from 'react';

import { RoleSwitch } from '@/shared/role';

const BuyerCompanyProfilePage = lazy(() => import('./buyer/pages/CompanyProfilePage'));
const VendorCompanyProfilePage = lazy(() => import('./vendor/pages/CompanyProfilePage'));

export default function CompanyProfileRoleSwitch() {
  return (
    <Suspense fallback={null}>
      <RoleSwitch
        byRole={{
          [UserRole.COMPANY_ADMIN]: <BuyerCompanyProfilePage />,
          [UserRole.VENDOR]: <VendorCompanyProfilePage />,
        }}
      />
    </Suspense>
  );
}
