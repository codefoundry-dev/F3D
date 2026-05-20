import { useTranslation } from '@forethread/i18n';
import { UserRole } from '@forethread/shared-types/client';
import { useMemo } from 'react';

import { ALL_ROLE_OPTIONS } from '../constants/roles';

export function useRoleOptions() {
  const { t } = useTranslation('users');

  return useMemo(
    () =>
      ALL_ROLE_OPTIONS.filter((role) => role !== UserRole.SUPER_ADMIN).map((role) => ({
        value: role,
        label: String(t(`roles.${role}` as 'roles.COMPANY_ADMIN')),
      })),
    [t],
  );
}
