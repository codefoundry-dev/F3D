import type { MrListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { formatDate, PageLoader } from '@forethread/ui-components';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { MobileHeader } from '../components/MobileHeader';
import { MobileShell } from '../components/MobileShell';
import { PriorityBadge } from '../components/PriorityBadge';
import { useMaterialRequests } from '../services/material-requests.service';
import { type MrPriority } from '../wizard/wizard-types';

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-[#F4F4F6] text-[#525866]',
  SUBMITTED: 'bg-[#FEF9C3] text-[#854D0E]',
  APPROVED: 'bg-[#DCFCE7] text-[#166534]',
  CONVERTED: 'bg-[#E0E7FF] text-[#3730A3]',
  DECLINED: 'bg-[#FEE2E2] text-[#991B1B]',
  CANCELLED: 'bg-[#F4F4F6] text-[#6D7588]',
};

/**
 * My Requests (linked from the confirmation screen — the Foreman's natural
 * landing). Lists the current user's material requests via
 * getMaterialRequests({ mine: true }) with status + priority badges.
 */
export default function MyRequestsPage() {
  const { t } = useTranslation('materialRequests');
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMaterialRequests({ mine: true });

  if (isLoading) return <PageLoader />;

  const requests = data?.items ?? [];

  return (
    <MobileShell
      header={<MobileHeader title={t('myRequests.title')} />}
      footer={
        <button
          type="button"
          onClick={() => navigate(ROUTES.materialRequestJobs)}
          className="flex h-[51px] w-full items-center justify-center gap-2 rounded-lg bg-[#1B1D22] text-base text-white hover:bg-[#2D3139]"
          data-testid="mr-new-request"
        >
          <PlusIcon className="h-4 w-4" />
          {t('myRequests.newRequest')}
        </button>
      }
    >
      <div className="flex flex-col gap-1 px-4 py-6">
        <p className="text-sm text-[#525866]">{t('myRequests.subtitle')}</p>

        {isError ? (
          <div className="px-1 py-12 text-center text-sm text-[#6D7588]">
            {t('myRequests.loadFailed')}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-16 text-center">
            <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#F4F4F6] text-[#999FAD]">
              <PackageIcon className="h-6 w-6" />
            </span>
            <p className="text-sm font-medium text-[#1B1D22]">{t('myRequests.empty')}</p>
            <p className="text-xs text-[#6D7588]">{t('myRequests.emptyHint')}</p>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2" data-testid="mr-requests-list">
            {requests.map((mr) => (
              <RequestRow key={mr.id} mr={mr} statusLabel={t(`status.${mr.status}` as never)} />
            ))}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}

function RequestRow({ mr, statusLabel }: { mr: MrListItem; statusLabel: string }) {
  const { t } = useTranslation('materialRequests');
  const tone = STATUS_TONE[mr.status] ?? 'bg-[#F4F4F6] text-[#525866]';
  return (
    <li>
      <div className="flex items-start gap-3 rounded-lg border border-[#E8EAED] px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-[#1B1D22]">{mr.mrNumber}</span>
            <span className={`rounded px-1.5 py-0.5 text-[11px] ${tone}`}>{statusLabel}</span>
          </div>
          <span className="truncate text-xs text-[#525866]">{mr.project.name}</span>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-xs text-[#6D7588]">
              {t('myRequests.itemsLabel', { count: mr.lineItemCount })}
            </span>
            <span className="text-[#D2D5DB]">•</span>
            <span className="text-xs text-[#6D7588]">
              {mr.neededByDate
                ? t('myRequests.neededBy', { date: formatDate(mr.neededByDate) })
                : t('myRequests.noNeededBy')}
            </span>
          </div>
          <span className="pt-1">
            <PriorityBadge priority={(mr.priority as MrPriority) ?? 'MEDIUM'} />
          </span>
        </div>
        <ChevronRightIcon className="mt-1 h-4 w-4 shrink-0 text-[#999FAD]" />
      </div>
    </li>
  );
}
