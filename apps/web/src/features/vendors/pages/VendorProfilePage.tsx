import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { VendorProfilePage as SharedVendorProfilePage } from '@forethread/vendor-shared';
import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

export default function VendorProfilePage() {
  const { t } = useTranslation('vendors');
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setPageTitle = usePageTitleStore((s) => s.setTitle);

  // Surface the page title + subtitle in the global app header; back-arrow
  // returns to the vendor list (US 3.07 — every screen titles itself there).
  useEffect(() => {
    setPageTitle(t('vendorProfile.pageTitle'), t('vendorProfile.pageSubtitle'), ROUTES.vendors);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  if (!id) return null;

  return (
    <SharedVendorProfilePage
      vendorId={id}
      onBack={() => navigate(-1)}
      initialEdit={searchParams.get('edit') === 'true'}
    />
  );
}
