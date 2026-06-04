import { UserRole } from '@forethread/shared-types/client';
import { PageLoader } from '@forethread/ui-components';
import { lazy, Suspense } from 'react';

import { ComingSoon } from '@/shared/components/ComingSoon';
import { RoleSwitch } from '@/shared/role';

/**
 * Renders the per-role dashboard at `/`. Each role's dashboard is lazy-loaded
 * so unused bundles aren't shipped.
 *
 * FINANCIAL_OFFICER and SUPER_ADMIN are bounced away from `/` by HomeRedirect
 * (their landing is `/invoices` and `/admin-panel` respectively), so they
 * never reach this switch via the home redirect path. The mapping is kept
 * so direct navigation to `/` keeps working for them.
 *
 * FOREMAN lands on `/` too, but the field-worker surface is the offline Field
 * PWA (ADR-0008), deferred to Phase 2. Until then FOREMAN gets a "Field App"
 * placeholder here instead of falling through to `/forbidden`. Tracked in
 * apps/web/MIGRATION.md.
 */
const BuyerDashboard = lazy(() => import('./pages/buyer/DashboardPage'));
const FinanceDashboard = lazy(() => import('./pages/finance/DashboardPage'));
const WarehouseDashboard = lazy(() => import('./pages/warehouse/DashboardPage'));
const VendorDashboard = lazy(() => import('./pages/vendor/DashboardPage'));
const SuperAdminDashboard = lazy(() => import('./pages/super-admin/DashboardPage'));

export function DashboardRoleSwitch() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RoleSwitch
        byRole={{
          [UserRole.COMPANY_ADMIN]: <BuyerDashboard />,
          [UserRole.PROCUREMENT_OFFICER]: <BuyerDashboard />,
          [UserRole.WAREHOUSE_OFFICER]: <WarehouseDashboard />,
          [UserRole.FOREMAN]: <ComingSoon page="Field App" />,
          [UserRole.VENDOR]: <VendorDashboard />,
          [UserRole.FINANCIAL_OFFICER]: <FinanceDashboard />,
          [UserRole.SUPER_ADMIN]: <SuperAdminDashboard />,
        }}
      />
    </Suspense>
  );
}
