import { Navigate } from 'react-router-dom';

import { ComingSoon } from '@/shared/components/ComingSoon';
import { homePathForRole, useUserRole } from '@/shared/role';

/**
 * Rendered at `/`. `@forethread/auth`'s `useVerifyOtp` hardcodes
 * `navigate('/')` after a successful OTP — so post-login every user lands
 * here. For roles whose canonical landing isn't `/` (today: SUPER_ADMIN ->
 * `/admin-panel`), bounce them. Everyone else sees the dashboard.
 */
export function HomeRedirect() {
  const role = useUserRole();
  const home = homePathForRole(role);

  if (home !== '/') {
    return <Navigate to={home} replace />;
  }

  return <ComingSoon page="Dashboard" />;
}
