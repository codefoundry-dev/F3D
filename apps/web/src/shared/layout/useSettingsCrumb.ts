import { useTranslation } from '@forethread/i18n';
import type { PageBreadcrumb } from '@forethread/rfq-shared';
import { useMemo } from 'react';

import { ROUTES } from '@/app/route-config';

/**
 * The `Settings` parent crumb for pages that are only reached through the
 * Settings page (Company, Roles, and — for non-Super-Admins — Users), so the
 * app-bar trail reads `Home › Settings › {page}` and Settings stays one click
 * away.
 */
export function useSettingsCrumb(): PageBreadcrumb {
  const { t } = useTranslation('nav');
  const label = t('settings', { defaultValue: 'Settings' });
  return useMemo(() => ({ label, to: ROUTES.settings }), [label]);
}
