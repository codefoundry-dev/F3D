import { UserRole } from '@forethread/shared-types/client';
import { Navigate, Outlet } from 'react-router-dom';

import { useUserRole } from './useUserRole';

interface RoleRouteProps {
  allow: readonly UserRole[];
  /** Where to send the user if their role isn't in `allow`. Defaults to /forbidden. */
  fallback?: string;
}

/**
 * Authorization layer that sits inside PrivateRoute. Renders the child route
 * only if the current user's role is in `allow`; otherwise redirects to
 * `fallback` (default `/forbidden`). Must be used under PrivateRoute so that
 * unauthenticated users are already redirected to /login.
 */
export function RoleRoute({ allow, fallback = '/forbidden' }: RoleRouteProps) {
  const role = useUserRole();

  if (!role || !allow.includes(role)) {
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
