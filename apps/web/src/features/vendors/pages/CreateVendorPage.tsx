import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { useEffect } from 'react';

import { ROUTES } from '@/app/route-config';

export default function CreateVendorPage() {
  const { t } = useTranslation('vendors');

  // App-bar breadcrumb: Vendors › Create vendor company.
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('createVendor.title'), null, ROUTES.vendors, [
      { label: t('title'), to: ROUTES.vendors },
      { label: t('createVendor.title') },
    ]);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  return (
    <div className="p-6">
      <p className="text-sm text-muted-foreground">{t('createVendor.comingSoon')}</p>
    </div>
  );
}
