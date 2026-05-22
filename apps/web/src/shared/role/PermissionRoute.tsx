import { Navigate, Outlet } from 'react-router-dom';

import { usePermissions } from './usePermissions';

interface PermissionRouteProps {
  /** Permission keys the user must hold. Empty means "no extra check". */
  require: readonly string[];
  /** When `any`, only one permission is required; default is `all`. */
  mode?: 'all' | 'any';
  /** Where to send the user if the check fails. Defaults to /forbidden. */
  fallback?: string;
}

/**
 * Authorization layer that gates a route on permission keys resolved from the
 * backend's `PermissionsService` (see `RequirePermissions` / `PermissionsGuard`
 * for the server-side counterpart). Must sit inside `PrivateRoute` so
 * unauthenticated users are already bounced to /login.
 */
export function PermissionRoute({
  require,
  mode = 'all',
  fallback = '/forbidden',
}: PermissionRouteProps) {
  const { hasAll, hasAny } = usePermissions();

  if (require.length === 0) {
    return <Outlet />;
  }

  const allowed = mode === 'any' ? hasAny(require) : hasAll(require);
  if (!allowed) {
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
