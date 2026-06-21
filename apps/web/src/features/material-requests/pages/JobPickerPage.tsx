import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { PageLoader } from '@forethread/ui-components';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import LocationIcon from '@forethread/ui-components/assets/icons/location.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import RequestIcon from '@forethread/ui-components/assets/icons/request.svg?react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { MobileHeader } from '../components/MobileHeader';
import { MobileShell } from '../components/MobileShell';
import { useMrProjects } from '../services/material-requests.service';

/**
 * Job picker (Figma 2002:176 — "My Jobs"). The Foreman's landing for the
 * Material Request flow: choose the job to raise materials for, which opens its
 * Job Overview. Rebuilt as a responsive design-system card grid.
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
          subline={t('jobOverview.selectJobHint')}
          onBack={() => navigate(ROUTES.materialRequests)}
          icon={<RequestIcon />}
        />
      }
    >
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card py-16 text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <PackageIcon className="size-6" />
          </span>
          <p className="text-sm font-medium text-foreground">{t('jobOverview.noJobs')}</p>
          <p className="max-w-sm text-xs text-muted-foreground">{t('jobOverview.noJobsHint')}</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="mr-job-list">
          {jobs.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                onClick={() =>
                  navigate(ROUTES.materialRequestJobOverview.replace(':projectId', job.id))
                }
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)] transition-colors hover:border-gray-200 hover:bg-accent/50"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <PackageIcon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {job.name}
                  </span>
                  {job.defaultDeliveryLocation && (
                    <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <LocationIcon className="size-3.5 shrink-0" />
                      {job.defaultDeliveryLocation}
                    </span>
                  )}
                </span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </MobileShell>
  );
}
