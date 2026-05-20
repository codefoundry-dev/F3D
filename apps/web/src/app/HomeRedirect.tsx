import { Navigate } from 'react-router-dom';

import { DashboardRoleSwitch } from '@/features/dashboard/DashboardRoleSwitch';
import { homePathForRole, useUserRole } from '@/shared/role';

/**
 * Rendered at `/`. `@forethread/auth`'s `useVerifyOtp` hardcodes
 * `navigate('/')` after a successful OTP — so post-login every user lands
 * here. For roles whose canonical landing isn't `/` (today: SUPER_ADMIN ->
 * `/admin-panel`, FINANCIAL_OFFICER -> `/invoices`), bounce them. Everyone
 * else renders the role-specific dashboard via `DashboardRoleSwitch`.
 */
export function HomeRedirect() {
  const role = useUserRole();
  const home = homePathForRole(role);

  if (home !== '/') {
    return <Navigate to={home} replace />;
  }

  return <DashboardRoleSwitch />;
}
