import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { useEffect } from 'react';

import { ROUTES } from '@/app/route-config';

export default function UploadInvoicePage() {
  const { t } = useTranslation('invoices');

  // App-bar breadcrumb: Invoices › Upload Invoice.
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('upload.title'), null, ROUTES.invoices, [
      { label: t('list.title'), to: ROUTES.invoices },
      { label: t('upload.title') },
    ]);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  return (
    <div className="p-6">
      <p className="text-sm text-muted-foreground">{t('upload.comingSoon')}</p>
    </div>
  );
}
