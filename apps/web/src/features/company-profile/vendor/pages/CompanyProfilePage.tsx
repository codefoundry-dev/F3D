import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { VendorProfilePage } from '@forethread/vendor-shared';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useAuthStore } from '@/features/auth/state/auth.store';

export default function CompanyProfilePage() {
  const { t } = useTranslation('vendors');
  const companyId = useAuthStore((s) => s.currentUser?.companyId);
  const navigate = useNavigate();
  const setPageTitle = usePageTitleStore((s) => s.setTitle);

  // Surface the page title + subtitle in the global app header; back-arrow
  // returns home (the vendor reaches its own company profile from the sidebar).
  useEffect(() => {
    setPageTitle(t('vendorProfile.pageTitle'), t('vendorProfile.pageSubtitle'), ROUTES.home);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  if (!companyId) return null;

  return <VendorProfilePage vendorId={companyId} onBack={() => navigate(-1)} />;
}
