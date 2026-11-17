import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { VendorProfilePage } from '@forethread/vendor-shared';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useAuthStore } from '@/features/auth/state/auth.store';
import { useSettingsCrumb } from '@/shared/layout/useSettingsCrumb';

export default function CompanyProfilePage() {
  const { t } = useTranslation('vendors');
  const companyId = useAuthStore((s) => s.currentUser?.companyId);
  const navigate = useNavigate();
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const settingsCrumb = useSettingsCrumb();

  // App-bar breadcrumb: Settings › Vendor Company Profile (the vendor reaches
  // its own company profile from the Settings page).
  useEffect(() => {
    setPageTitle(t('vendorProfile.pageTitle'), t('vendorProfile.pageSubtitle'), ROUTES.settings, [
      settingsCrumb,
      { label: t('vendorProfile.pageTitle') },
    ]);
    return () => setPageTitle(null);
  }, [setPageTitle, t, settingsCrumb]);

  if (!companyId) return null;

  return <VendorProfilePage vendorId={companyId} onBack={() => navigate(-1)} />;
}
