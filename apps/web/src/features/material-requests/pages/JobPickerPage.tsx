import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { PageLoader } from '@forethread/ui-components';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { MobileHeader } from '../components/MobileHeader';
import { MobileShell } from '../components/MobileShell';
import { useMrProjects } from '../services/material-requests.service';

/**
 * Job picker (Figma 2002:176 frames 2155:493 / 2155:924 — "My Jobs"). The
 * Foreman's landing for the Material Request flow: choose the job to raise
 * materials for, which opens its Job Overview.
 */
export default function JobPickerPage() {
  const { t } = useTranslation('materialRequests');
  const navigate = useNavigate();
  const { data: projects, isLoading } = useMrProjects();

  // App-bar breadcrumb / page title.
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('jobOverview.selectJob'), null, ROUTES.materialRequests, [
      { label: t('jobOverview.selectJob') },
    ]);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  if (isLoading) return <PageLoader />;

  const jobs = projects ?? [];

  return (
    <MobileShell
      header={
        <MobileHeader
          title={t('jobOverview.selectJob')}
          onBack={() => navigate(ROUTES.materialRequests)}
        />
      }
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm text-gray-600">{t('jobOverview.selectJobHint')}</p>

        {jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-16 text-center">
            <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">
              <PackageIcon className="h-6 w-6" />
            </span>
            <p className="text-sm font-medium text-gray-900">{t('jobOverview.noJobs')}</p>
            <p className="text-xs text-gray-500">{t('jobOverview.noJobsHint')}</p>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2" data-testid="mr-job-list">
            {jobs.map((job) => (
              <li key={job.id}>
                <button
                  type="button"
                  onClick={() =>
                    navigate(ROUTES.materialRequestJobOverview.replace(':projectId', job.id))
                  }
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-4 text-left shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)] transition-colors hover:bg-gray-25"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">
                      {job.name}
                    </span>
                    {job.defaultDeliveryLocation && (
                      <span className="block truncate text-xs text-gray-500">
                        {job.defaultDeliveryLocation}
                      </span>
                    )}
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}
