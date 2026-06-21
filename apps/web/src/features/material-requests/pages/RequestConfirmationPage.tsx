import type { MrDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { PageLoader } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import FlagIcon from '@forethread/ui-components/assets/icons/flag.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import ProjectsIcon from '@forethread/ui-components/assets/icons/projects.svg?react';
import { useEffect } from 'react';
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
 * Request Confirmation (Figma 2002:176 frame 14:622), rebuilt as a centred
 * design-system success card. Shows the created MR's `mrNumber` as the Reference
 * ID, a request summary and a "what happens next" list, plus Done / View My
 * Requests actions. The MR is handed over via router state from the wizard;
 * falls back to a fetch by id on direct navigation.
 */
export default function RequestConfirmationPage() {
  const { t } = useTranslation('materialRequests');
  const navigate = useNavigate();
  const location = useLocation();
  const { id = '' } = useParams<{ id: string }>();
  const stateMr = (location.state as ConfirmationState | null)?.mr;

  const fetched = useMaterialRequest(stateMr ? undefined : id);
  const mr = stateMr ?? fetched.data;

  // App-bar breadcrumb / page title.
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('confirmation.title'), null, ROUTES.materialRequests, [
      { label: t('confirmation.title') },
    ]);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

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
        <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
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
    >
      <div className="mx-auto max-w-xl">
        <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 sm:p-8">
          {/* Success banner */}
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-green-50 text-green-600">
              <CheckCircleIcon className="size-8" />
            </span>
            <div>
              <p className="text-lg font-semibold text-foreground">{t('confirmation.submitted')}</p>
              <p className="text-sm text-muted-foreground">{t('confirmation.submittedHint')}</p>
            </div>
          </div>

          {/* Reference id */}
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('confirmation.referenceId')}
            </p>
            <p className="text-lg font-semibold text-foreground" data-testid="mr-reference-id">
              {mr.mrNumber}
            </p>
          </div>

          {/* Request summary */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-foreground">
              {t('confirmation.summaryTitle')}
            </p>
            <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <SummaryRow icon={<ProjectsIcon className="size-4" />} label={t('confirmation.job')}>
                {mr.project.name}
              </SummaryRow>
              <SummaryRow
                icon={<PackageIcon className="size-4" />}
                label={t('confirmation.totalItems')}
              >
                {t('confirmation.totalItemsValue', { count: mr.lineItems.length })}
              </SummaryRow>
              <SummaryRow icon={<FlagIcon className="size-4" />} label={t('confirmation.priority')}>
                {t(priorityKey as never)}
              </SummaryRow>
            </div>
          </div>

          {/* What happens next */}
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-foreground">{t('confirmation.whatNext')}</h4>
            <ul className="flex flex-col gap-3">
              {['next1', 'next2', 'next3'].map((key) => (
                <li key={key} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <CheckCircleIcon className="size-3.5" />
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t(`confirmation.${key}` as never)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
            <SecondaryButton
              onClick={() => navigate(ROUTES.materialRequests)}
              className="w-full sm:w-auto"
              data-testid="mr-confirm-view"
            >
              {t('confirmation.viewMyRequests')}
            </SecondaryButton>
            <PrimaryButton
              leading={<CheckCircleIcon className="size-4" />}
              onClick={() => navigate(ROUTES.materialRequests)}
              className="w-full sm:w-auto"
              data-testid="mr-confirm-done"
            >
              {t('confirmation.done')}
            </PrimaryButton>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {t('confirmation.savedHint', { code: mr.mrNumber })}
          </p>
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
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{children}</p>
      </div>
    </div>
  );
}
