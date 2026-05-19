import { Navigate, Outlet, useLocation } from 'react-router-dom';

export interface PrivateRouteProps {
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Whether the initial auth check is still in progress */
  isAuthLoading?: boolean;
  /** Path to redirect to when not authenticated (defaults to "/login") */
  loginPath?: string;
}

export function PrivateRoute({
  isAuthenticated,
  isAuthLoading = false,
  loginPath = '/login',
}: PrivateRouteProps) {
  const location = useLocation();

  if (isAuthLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  return <Outlet />;
}
