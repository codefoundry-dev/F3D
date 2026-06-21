import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { useEffect } from 'react';

export default function AdminPanelPage() {
  const { t } = useTranslation('dashboard');
  const { t: tNav } = useTranslation('nav');

  // App-bar breadcrumb / page title (top-level list page → single leaf crumb).
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(tNav('adminPanel'), null, null, [{ label: tNav('adminPanel') }]);
    return () => setPageTitle(null);
  }, [setPageTitle, tNav]);

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* External Integrations */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {t('adminPanel.integrations', { defaultValue: 'External Integrations' })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('adminPanel.integrationsDesc', {
              defaultValue: 'ERP, accounting, inventory, email ingestion status.',
            })}
          </p>
          <div className="text-xs text-muted-foreground italic">
            {t('adminPanel.comingSoon', { defaultValue: 'Detailed view coming soon.' })}
          </div>
        </div>

        {/* Background Jobs */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {t('adminPanel.backgroundJobs', { defaultValue: 'Background Jobs' })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('adminPanel.backgroundJobsDesc', {
              defaultValue: 'OCR processing, email ingestion, synchronization tasks.',
            })}
          </p>
          <div className="text-xs text-muted-foreground italic">
            {t('adminPanel.comingSoon', { defaultValue: 'Detailed view coming soon.' })}
          </div>
        </div>

        {/* Notification Delivery */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {t('adminPanel.notifications', { defaultValue: 'Notification Delivery' })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('adminPanel.notificationsDesc', {
              defaultValue: 'Email service and in-app delivery monitoring.',
            })}
          </p>
          <div className="text-xs text-muted-foreground italic">
            {t('adminPanel.comingSoon', { defaultValue: 'Detailed view coming soon.' })}
          </div>
        </div>
      </div>
    </div>
  );
}
