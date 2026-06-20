import { useTranslation } from '@forethread/i18n';
import { PageLoader } from '@forethread/ui-components';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
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

  if (isLoading) return <PageLoader />;

  const jobs = projects ?? [];

  return (
    <MobileShell header={<MobileHeader title={t('jobOverview.selectJob')} />}>
      <div className="flex flex-col gap-1 px-4 py-6">
        <p className="text-sm text-[#525866]">{t('jobOverview.selectJobHint')}</p>

        {jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-16 text-center">
            <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#F4F4F6] text-[#999FAD]">
              <PackageIcon className="h-6 w-6" />
            </span>
            <p className="text-sm font-medium text-[#1B1D22]">{t('jobOverview.noJobs')}</p>
            <p className="text-xs text-[#6D7588]">{t('jobOverview.noJobsHint')}</p>
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
                  className="flex w-full items-center gap-3 rounded-lg border border-[#E8EAED] px-4 py-4 text-left hover:bg-[#FDFDFD]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[#1B1D22]">
                      {job.name}
                    </span>
                    {job.defaultDeliveryLocation && (
                      <span className="block truncate text-xs text-[#6D7588]">
                        {job.defaultDeliveryLocation}
                      </span>
                    )}
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#999FAD]" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}
