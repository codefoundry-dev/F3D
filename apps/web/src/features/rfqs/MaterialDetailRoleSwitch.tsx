import { UserRole } from '@forethread/shared-types';
import { lazy, Suspense } from 'react';

import { ComingSoon } from '@/shared/components/ComingSoon';
import { RoleSwitch } from '@/shared/role';

const VendorMaterialDetailPage = lazy(() => import('./vendor/pages/MaterialDetailPage'));

/**
 * The vendor side of "Material detail" lives in `features/rfqs/vendor/`. The
 * buyer side is owned by the `material-catalogue` feature and ships once that
 * row migrates — for now buyers see the ComingSoon placeholder.
 */
export default function MaterialDetailRoleSwitch() {
  return (
    <Suspense fallback={null}>
      <RoleSwitch
        byRole={{
          [UserRole.VENDOR]: <VendorMaterialDetailPage />,
          [UserRole.COMPANY_ADMIN]: <ComingSoon page="Material detail" />,
          [UserRole.PROCUREMENT_OFFICER]: <ComingSoon page="Material detail" />,
        }}
      />
    </Suspense>
  );
}
