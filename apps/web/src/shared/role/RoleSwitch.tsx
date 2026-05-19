import { UserRole } from '@forethread/shared-types';
import { Navigate } from 'react-router-dom';

import { useUserRole } from './useUserRole';

interface RoleSwitchProps {
  /**
   * Map from role to the element that role should see. Missing keys are
   * treated as "not allowed" and redirect to `fallback`. Use this when the
   * same URL needs to render a different page for different roles (e.g.,
   * /rfqs/:id shows a vendor response page for VENDOR and an internal detail
   * page for COMPANY_ADMIN).
   */
  byRole: Partial<Record<UserRole, React.ReactNode>>;
  fallback?: string;
}

export function RoleSwitch({ byRole, fallback = '/forbidden' }: RoleSwitchProps) {
  const role = useUserRole();
  if (!role) return <Navigate to={fallback} replace />;
  const element = byRole[role];
  if (element === undefined) return <Navigate to={fallback} replace />;
  return <>{element}</>;
}
