import { UserRole } from '@forethread/shared-types/client';
import { lazy, Suspense } from 'react';

import { RoleSwitch } from '@/shared/role';

// Foreman / Warehouse keep the existing mobile "raise a request" flow; the
// procurement-side roles get the US 2.08 officer review dashboard.
const MyRequestsPage = lazy(() => import('./pages/MyRequestsPage'));
const OfficerDashboardPage = lazy(() => import('./officer/pages/OfficerDashboardPage'));

export default function MaterialRequestListRoleSwitch() {
  return (
    <Suspense fallback={null}>
      <RoleSwitch
        byRole={{
          [UserRole.FOREMAN]: <MyRequestsPage />,
          [UserRole.WAREHOUSE_OFFICER]: <MyRequestsPage />,
          [UserRole.PROCUREMENT_OFFICER]: <OfficerDashboardPage />,
          [UserRole.COMPANY_ADMIN]: <OfficerDashboardPage />,
          [UserRole.SUPER_ADMIN]: <OfficerDashboardPage />,
        }}
      />
    </Suspense>
  );
}
