import { useTranslation } from '@forethread/i18n';
import type { PageBreadcrumb } from '@forethread/rfq-shared';
import { UserRole } from '@forethread/shared-types/client';
import { useMemo } from 'react';

import { ROUTES } from '@/app/route-config';
import { useUserRole } from '@/shared/role';

/**
 * The root crumb of the material-request flow — the `/material-requests` list,
 * labelled the way that list titles itself for the current role ("My Requests"
 * for Foreman / Warehouse, "Material requests" for the procurement roles; see
 * `MaterialRequestListRoleSwitch`).
 */
export function useMaterialRequestsCrumb(): PageBreadcrumb {
  const { t } = useTranslation('materialRequests');
  const role = useUserRole();
  const raisesRequests = role === UserRole.FOREMAN || role === UserRole.WAREHOUSE_OFFICER;
  const label = raisesRequests ? t('myRequests.title') : t('officer.title');
  return useMemo(() => ({ label, to: ROUTES.materialRequests }), [label]);
}
