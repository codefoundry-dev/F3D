import { useTranslation } from '@forethread/i18n';
import { useMemo } from 'react';

import { COMPANY_ROLE_OPTIONS } from '../constants/roles';

export function useRoleOptions() {
  const { t } = useTranslation('users');

  return useMemo(
    () =>
      COMPANY_ROLE_OPTIONS.map((role) => ({
        value: role,
        label: String(t(`roles.${role}` as 'roles.COMPANY_ADMIN')),
      })),
    [t],
  );
}
