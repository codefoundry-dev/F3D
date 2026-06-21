import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Badge, formatDate, PageLoader } from '@forethread/ui-components';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import RequestIcon from '@forethread/ui-components/assets/icons/request.svg?react';
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { PrimaryButton } from '../components/MobileButtons';
import { MobileHeader } from '../components/MobileHeader';
import { MobileShell } from '../components/MobileShell';
import { ProcurementStatusBar, type ProcurementStage } from '../components/ProcurementStatusBar';
import { useMrProjectDetail } from '../services/material-requests.service';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 px-4 py-3">
      <span className="text-2xl font-semibold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Job Overview (Figma 2002:176 frame 14:4), rebuilt on the desktop design
 * system to read like the officer Material Request detail page: a header card
 * with the job meta grid + stat tiles, a procurement-status timeline card, and
 * the "Request Materials" CTA in the page header. Fields not exposed by the
 * projects API (% complete, days-left) fall back to placeholders.
 */
export default function JobOverviewPage() {
  const { t } = useTranslation('materialRequests');
  const navigate = useNavigate();
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { data: project, isLoading, isError } = useMrProjectDetail(projectId);

  // App-bar breadcrumb / page title (back → job picker).
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('jobOverview.title'), null, ROUTES.materialRequestJobs, [
      { label: t('jobOverview.selectJob'), to: ROUTES.materialRequestJobs },
      { label: t('jobOverview.title') },
    ]);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const deliveryLocation = useMemo(
    () =>
      (project?.locations ?? []).find((l) => l.type === 'DELIVERY' && l.isDefault) ??
      (project?.locations ?? []).find((l) => l.type === 'DELIVERY'),
    [project?.locations],
  );

  // Derived procurement timeline. The projects API exposes counts (rfqCount,
  // poCount) but not per-stage delivery state, so we light up the early stages
  // from those counts and leave the delivery stages pending.
  const stages: ProcurementStage[] = useMemo(() => {
    const rfqDone = (project?.rfqCount ?? 0) > 0;
    const poDone = (project?.poCount ?? 0) > 0;
    return [
      { key: 'rfqCreated', label: t('procurement.rfqCreated'), done: rfqDone },
      { key: 'rfqApproved', label: t('procurement.rfqApproved'), done: rfqDone },
      { key: 'poIssued', label: t('procurement.poIssued'), done: poDone },
      { key: 'expectedDelivery', label: t('procurement.expectedDelivery'), done: false },
      { key: 'materialInTransit', label: t('procurement.materialInTransit'), done: false },
      { key: 'delivered', label: t('procurement.delivered'), done: false },
      { key: 'received', label: t('procurement.received'), done: false },
    ];
  }, [project?.rfqCount, project?.poCount, t]);

  if (isLoading) return <PageLoader />;

  if (isError || !project) {
    return (
      <MobileShell
        header={
          <MobileHeader
            title={t('jobOverview.title')}
            onBack={() => navigate(ROUTES.materialRequestJobs)}
            icon={<RequestIcon />}
          />
        }
      >
        <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          {t('jobOverview.loadFailed')}
        </div>
      </MobileShell>
    );
  }

  const notProvided = t('jobOverview.notProvided');

  return (
    <MobileShell
      header={
        <MobileHeader
          title={t('jobOverview.title')}
          onBack={() => navigate(ROUTES.materialRequestJobs)}
          icon={<RequestIcon />}
          subline={t('jobOverview.projectLabel', { code: project.name })}
          trailing={
            <PrimaryButton
              leading={<PlusIcon className="size-4" />}
              onClick={() => navigate(ROUTES.materialRequestNew.replace(':projectId', projectId))}
              className="w-full sm:w-auto"
              data-testid="mr-request-materials"
            >
              {t('jobOverview.requestMaterials')}
            </PrimaryButton>
          }
        />
      }
    >
      <div className="flex flex-col gap-6">
        {/* Job header + details */}
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('jobOverview.jobId')}
              </p>
              <p className="truncate text-2xl font-semibold text-foreground">{project.name}</p>
              {project.description && (
                <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
              )}
            </div>
            <Badge color="green" className="shrink-0">
              {t('jobOverview.statusActive')}
            </Badge>
          </div>

          <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t('jobOverview.location')}>
              {deliveryLocation ? deliveryLocation.address : notProvided}
            </Field>
            <Field label={t('jobOverview.projectManager')}>
              {project.pointOfContact ? project.pointOfContact.name : notProvided}
            </Field>
            <Field label={t('jobOverview.startDate')}>
              {project.startDate ? formatDate(project.startDate) : notProvided}
            </Field>
            <Field label={t('jobOverview.estCompletion')}>
              {project.expectedEndDate ? formatDate(project.expectedEndDate) : notProvided}
            </Field>
            <Field label={t('jobOverview.crewSize')}>
              {t('jobOverview.crewSizeValue', { count: project.assignedUsers?.length ?? 0 })}
            </Field>
          </dl>

          {/* Stat tiles. Only PO count is API-backed; the others are placeholders. */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile value="—" label={t('jobOverview.statComplete')} />
            <StatTile value="—" label={t('jobOverview.statDaysLeft')} />
            <StatTile value={String(project.poCount ?? 0)} label={t('jobOverview.statPending')} />
          </div>
        </div>

        {/* Procurement status timeline */}
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <ProcurementStatusBar stages={stages} />
        </div>
      </div>
    </MobileShell>
  );
}
