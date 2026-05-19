import { Navigate, Outlet } from 'react-router-dom';

export interface GuestRouteProps {
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Whether the initial auth check is still in progress */
  isAuthLoading?: boolean;
  /** Path to redirect to when authenticated (defaults to "/") */
  homePath?: string;
}

export function GuestRoute({
  isAuthenticated,
  isAuthLoading = false,
  homePath = '/',
}: GuestRouteProps) {
  if (isAuthLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to={homePath} replace />;
  }

  return <Outlet />;
}
