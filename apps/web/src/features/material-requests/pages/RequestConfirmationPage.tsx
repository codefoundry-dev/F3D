import type { MrDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { PageLoader } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import FlagIcon from '@forethread/ui-components/assets/icons/flag.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import ProjectsIcon from '@forethread/ui-components/assets/icons/projects.svg?react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { PrimaryButton, SecondaryButton } from '../components/MobileButtons';
import { MobileHeader } from '../components/MobileHeader';
import { MobileShell } from '../components/MobileShell';
import { useMaterialRequest } from '../services/material-requests.service';

interface ConfirmationState {
  mr?: MrDetail;
}

const PRIORITY_LABEL_KEY: Record<string, string> = {
  LOW: 'priority.LOW',
  MEDIUM: 'priority.MEDIUM',
  HIGH: 'priority.HIGH',
  URGENT: 'priority.URGENT',
};

/**
 * Request Confirmation (Figma 2002:176 frame 14:622). Shows the created MR's
 * `mrNumber` as the Reference ID, a request summary and "what happens next"
 * list, plus Done / View My Requests actions. The MR is handed over via router
 * state from the wizard; falls back to a fetch by id on direct navigation.
 */
export default function RequestConfirmationPage() {
  const { t } = useTranslation('materialRequests');
  const navigate = useNavigate();
  const location = useLocation();
  const { id = '' } = useParams<{ id: string }>();
  const stateMr = (location.state as ConfirmationState | null)?.mr;

  const fetched = useMaterialRequest(stateMr ? undefined : id);
  const mr = stateMr ?? fetched.data;

  if (!mr) {
    return fetched.isLoading ? (
      <PageLoader />
    ) : (
      <MobileShell
        header={
          <MobileHeader
            title={t('confirmation.title')}
            onBack={() => navigate(ROUTES.materialRequests)}
          />
        }
      >
        <div className="px-4 py-12 text-center text-sm text-[#737373]">
          {t('myRequests.loadFailed')}
        </div>
      </MobileShell>
    );
  }

  const priorityKey = PRIORITY_LABEL_KEY[mr.priority] ?? 'priority.MEDIUM';

  return (
    <MobileShell
      header={
        <MobileHeader
          title={t('confirmation.title')}
          onBack={() => navigate(ROUTES.materialRequests)}
        />
      }
      footer={
        <div className="flex flex-col gap-3">
          <PrimaryButton
            leading={<CheckCircleIcon className="h-4 w-4" />}
            onClick={() => navigate(ROUTES.materialRequests)}
            data-testid="mr-confirm-done"
          >
            {t('confirmation.done')}
          </PrimaryButton>
          <SecondaryButton
            onClick={() => navigate(ROUTES.materialRequests)}
            data-testid="mr-confirm-view"
          >
            {t('confirmation.viewMyRequests')}
          </SecondaryButton>
          <p className="text-center text-xs text-[#737373]">
            {t('confirmation.savedHint', { code: mr.mrNumber })}
          </p>
        </div>
      }
    >
      <div className="flex flex-col gap-6 px-4 py-6">
        {/* Success banner */}
        <div className="flex flex-col items-center gap-4 pt-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#171717] text-white">
            <CheckCircleIcon className="h-8 w-8" />
          </span>
          <div>
            <p className="text-lg font-semibold text-[#171717]">{t('confirmation.submitted')}</p>
            <p className="text-sm text-[#525252]">{t('confirmation.submittedHint')}</p>
          </div>
        </div>

        {/* Reference id */}
        <div className="rounded-lg bg-[#F5F5F5] px-4 py-3 text-center">
          <p className="text-xs text-[#525252]">{t('confirmation.referenceId')}</p>
          <p className="text-lg font-medium text-[#171717]" data-testid="mr-reference-id">
            {mr.mrNumber}
          </p>
        </div>

        {/* Request summary */}
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-[#171717]">{t('confirmation.summaryTitle')}</p>
          <div className="flex flex-col gap-3 rounded-lg border border-[#E5E5E5] p-4">
            <SummaryRow icon={<ProjectsIcon className="h-4 w-4" />} label={t('confirmation.job')}>
              <span className="text-sm text-[#171717]">{mr.project.name}</span>
            </SummaryRow>
            <SummaryRow
              icon={<PackageIcon className="h-4 w-4" />}
              label={t('confirmation.totalItems')}
            >
              <span className="text-sm text-[#171717]">
                {t('confirmation.totalItemsValue', { count: mr.lineItems.length })}
              </span>
            </SummaryRow>
            <SummaryRow icon={<FlagIcon className="h-4 w-4" />} label={t('confirmation.priority')}>
              <span className="text-sm text-[#171717]">{t(priorityKey as never)}</span>
            </SummaryRow>
          </div>
        </div>

        {/* What happens next */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-medium text-[#171717]">{t('confirmation.whatNext')}</h4>
          <ul className="flex flex-col gap-3">
            {['next1', 'next2', 'next3'].map((key) => (
              <li key={key} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[#404040]">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm text-[#525252]">{t(`confirmation.${key}` as never)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </MobileShell>
  );
}

function SummaryRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F5F5F5] text-[#404040]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-[#525252]">{label}</p>
        {children}
      </div>
    </div>
  );
}
