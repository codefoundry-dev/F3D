import { UserRole } from '@forethread/shared-types/client';
import { lazy, Suspense } from 'react';

import { RoleSwitch } from '@/shared/role';

const SuperAdminUserDetailPage = lazy(() => import('./super-admin/ui/UserDetailPage'));
const CompanyAdminUserDetailPage = lazy(() => import('./company-admin/ui/UserDetailPage'));
const VendorUserDetailPage = lazy(() => import('./vendor/ui/VendorUserDetailPage'));

export default function UserDetailRoleSwitch() {
  return (
    <Suspense fallback={null}>
      <RoleSwitch
        byRole={{
          [UserRole.SUPER_ADMIN]: <SuperAdminUserDetailPage />,
          [UserRole.COMPANY_ADMIN]: <CompanyAdminUserDetailPage />,
          [UserRole.VENDOR]: <VendorUserDetailPage />,
        }}
      />
    </Suspense>
  );
}
