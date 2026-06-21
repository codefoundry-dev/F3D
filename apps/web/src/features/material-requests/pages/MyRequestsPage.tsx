import type { MrListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { formatDate, PageLoader } from '@forethread/ui-components';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { PrimaryButton } from '../components/MobileButtons';
import { MobileHeader } from '../components/MobileHeader';
import { MobileShell } from '../components/MobileShell';
import { MrPriorityBadge, MrStatusBadge } from '../officer/components/MrStatusBadge';
import { useMaterialRequests } from '../services/material-requests.service';

/**
 * My Requests (linked from the confirmation screen — the Foreman's natural
 * landing). Lists the current user's material requests via
 * getMaterialRequests({ mine: true }) with status + priority badges.
 */
export default function MyRequestsPage() {
  const { t } = useTranslation('materialRequests');
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMaterialRequests({ mine: true });

  // App-bar breadcrumb / page title.
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('myRequests.title'), null, null, [{ label: t('myRequests.title') }]);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  if (isLoading) return <PageLoader />;

  const requests = data?.items ?? [];

  return (
    <MobileShell
      header={<MobileHeader title={t('myRequests.title')} />}
      footer={
        <PrimaryButton
          leading={<PlusIcon className="h-4 w-4" />}
          onClick={() => navigate(ROUTES.materialRequestJobs)}
          data-testid="mr-new-request"
        >
          {t('myRequests.newRequest')}
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm text-gray-600">{t('myRequests.subtitle')}</p>

        {isError ? (
          <div className="px-1 py-12 text-center text-sm text-gray-500">
            {t('myRequests.loadFailed')}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-16 text-center">
            <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">
              <PackageIcon className="h-6 w-6" />
            </span>
            <p className="text-sm font-medium text-gray-900">{t('myRequests.empty')}</p>
            <p className="text-xs text-gray-500">{t('myRequests.emptyHint')}</p>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2" data-testid="mr-requests-list">
            {requests.map((mr) => (
              <RequestRow key={mr.id} mr={mr} />
            ))}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}

function RequestRow({ mr }: { mr: MrListItem }) {
  const { t } = useTranslation('materialRequests');
  return (
    <li>
      <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-gray-900">{mr.mrNumber}</span>
            <MrStatusBadge status={mr.status} />
          </div>
          <span className="truncate text-xs text-gray-600">{mr.project.name}</span>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-xs text-gray-500">
              {t('myRequests.itemsLabel', { count: mr.lineItemCount })}
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-xs text-gray-500">
              {mr.neededByDate
                ? t('myRequests.neededBy', { date: formatDate(mr.neededByDate) })
                : t('myRequests.noNeededBy')}
            </span>
          </div>
          <span className="pt-1">
            <MrPriorityBadge priority={mr.priority ?? 'MEDIUM'} />
          </span>
        </div>
        <ChevronRightIcon className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
      </div>
    </li>
  );
}
