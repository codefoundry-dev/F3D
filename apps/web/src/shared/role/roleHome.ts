import { UserRole } from '@forethread/shared-types/client';

/**
 * Landing path for each role after login. Used by:
 *   - the GuestRoute redirect ("/" after login)
 *   - the logo-click handler in AppLayout
 *   - the Forbidden page "Go home" CTA
 */
export const ROLE_HOME_PATH: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: '/admin-panel',
  [UserRole.COMPANY_ADMIN]: '/',
  [UserRole.PROCUREMENT_OFFICER]: '/',
  [UserRole.FINANCIAL_OFFICER]: '/invoices',
  [UserRole.WAREHOUSE_OFFICER]: '/',
  [UserRole.FOREMAN]: '/material-requests',
  [UserRole.VENDOR]: '/',
};

export function homePathForRole(role: UserRole | null | undefined): string {
  if (!role) return '/';
  return ROLE_HOME_PATH[role] ?? '/';
}
