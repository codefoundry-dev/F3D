import { UserRole } from '@forethread/shared-types/client';
import { lazy, Suspense } from 'react';

import { RoleSwitch } from '@/shared/role';

const SuperAdminUserListPage = lazy(() => import('./super-admin/ui/UserListPage'));
const CompanyAdminUserListPage = lazy(() => import('./company-admin/ui/UserListPage'));
const VendorUserListPage = lazy(() => import('./vendor/ui/VendorUserListPage'));

export default function UserListRoleSwitch() {
  return (
    <Suspense fallback={null}>
      <RoleSwitch
        byRole={{
          [UserRole.SUPER_ADMIN]: <SuperAdminUserListPage />,
          [UserRole.COMPANY_ADMIN]: <CompanyAdminUserListPage />,
          [UserRole.VENDOR]: <VendorUserListPage />,
        }}
      />
    </Suspense>
  );
}
