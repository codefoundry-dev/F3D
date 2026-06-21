import type { MrListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { formatDate, PageLoader } from '@forethread/ui-components';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import RequestIcon from '@forethread/ui-components/assets/icons/request.svg?react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { PrimaryButton } from '../components/MobileButtons';
import { MobileHeader } from '../components/MobileHeader';
import { MobileShell } from '../components/MobileShell';
import { MrPriorityBadge, MrStatusBadge } from '../officer/components/MrStatusBadge';
import { useMaterialRequests } from '../services/material-requests.service';

const COLUMNS = ['mrNumber', 'project', 'items', 'neededBy', 'priority', 'status'] as const;

/**
 * My Requests — the Foreman's landing list of the requests they have raised
 * (getMaterialRequests({ mine: true })). Rebuilt on the design-system table used
 * by the procurement-side dashboards so it matches the rest of the app.
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
      header={
        <MobileHeader
          title={t('myRequests.title')}
          subline={t('myRequests.subtitle')}
          icon={<RequestIcon />}
          trailing={
            <PrimaryButton
              leading={<PlusIcon className="size-4" />}
              onClick={() => navigate(ROUTES.materialRequestJobs)}
              className="w-full sm:w-auto"
              data-testid="mr-new-request"
            >
              {t('myRequests.newRequest')}
            </PrimaryButton>
          }
        />
      }
    >
      {isError ? (
        <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          {t('myRequests.loadFailed')}
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card py-16 text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <PackageIcon className="size-6" />
          </span>
          <p className="text-sm font-medium text-foreground">{t('myRequests.empty')}</p>
          <p className="max-w-sm text-xs text-muted-foreground">{t('myRequests.emptyHint')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm" data-testid="mr-requests-list">
            <thead>
              <tr className="border-b border-border bg-[hsl(var(--table-header))] text-left text-[hsl(var(--table-header-foreground))]">
                {COLUMNS.map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap px-4 py-3 text-xs font-bold leading-4 tracking-[0.6px]"
                  >
                    {t(`myRequests.columns.${col}` as never)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map((mr) => (
                <RequestRow key={mr.id} mr={mr} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MobileShell>
  );
}

function RequestRow({ mr }: { mr: MrListItem }) {
  const { t } = useTranslation('materialRequests');
  return (
    <tr className="border-b border-border transition-colors last:border-b-0 hover:bg-accent/50">
      <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{mr.mrNumber}</td>
      <td className="max-w-[220px] truncate px-4 py-3 text-foreground">{mr.project.name}</td>
      <td className="px-4 py-3 text-foreground">{mr.lineItemCount}</td>
      <td className="whitespace-nowrap px-4 py-3 text-foreground">
        {mr.neededByDate ? formatDate(mr.neededByDate) : t('myRequests.noNeededBy')}
      </td>
      <td className="px-4 py-3">
        <MrPriorityBadge priority={mr.priority ?? 'MEDIUM'} />
      </td>
      <td className="px-4 py-3">
        <MrStatusBadge status={mr.status} />
      </td>
    </tr>
  );
}
