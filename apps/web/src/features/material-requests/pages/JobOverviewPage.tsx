import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Badge, formatDate, PageLoader } from '@forethread/ui-components';
import CalendarIcon from '@forethread/ui-components/assets/icons/date.svg?react';
import LocationIcon from '@forethread/ui-components/assets/icons/location.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import UserIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';
import UsersIcon from '@forethread/ui-components/assets/icons/users-group.svg?react';
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { PrimaryButton } from '../components/MobileButtons';
import { MobileHeader } from '../components/MobileHeader';
import { MobileShell } from '../components/MobileShell';
import { ProcurementStatusBar, type ProcurementStage } from '../components/ProcurementStatusBar';
import { useMrProjectDetail } from '../services/material-requests.service';

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-700">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-gray-600">{label}</p>
        <div className="text-sm text-gray-900">{children}</div>
      </div>
    </div>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-lg bg-gray-50 px-3 py-2">
      <span className="text-2xl text-gray-900">{value}</span>
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}

/**
 * Job Overview (Figma 2002:176 frame 14:4). Shows the selected job's header,
 * a procurement-status timeline, the job details card and three stat tiles, with
 * the primary "Request Materials" CTA. Fields not exposed by the projects API
 * (PM email, crew size, % complete, days-left, pending) fall back to derived or
 * placeholder values — see the build notes.
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
          />
        }
      >
        <div className="py-12 text-center text-sm text-gray-500">{t('jobOverview.loadFailed')}</div>
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
          subline={
            <span className="text-sm text-gray-500">
              {t('jobOverview.projectLabel', { code: project.name })}
            </span>
          }
        />
      }
      footer={
        <div className="flex flex-col gap-2">
          <PrimaryButton
            leading={<PlusIcon className="h-4 w-4" />}
            onClick={() => navigate(ROUTES.materialRequestNew.replace(':projectId', projectId))}
            data-testid="mr-request-materials"
          >
            {t('jobOverview.requestMaterials')}
          </PrimaryButton>
          <p className="text-center text-xs text-gray-500">
            {t('jobOverview.requestMaterialsHint')}
          </p>
        </div>
      }
    >
      <div className="flex flex-col gap-7">
        {/* Job header card */}
        <div className="flex flex-col gap-3 rounded-lg bg-gray-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-600">{t('jobOverview.jobId')}</p>
              <p className="truncate text-2xl text-gray-900">{project.name}</p>
            </div>
            <Badge color="green" className="shrink-0">
              {t('jobOverview.statusActive')}
            </Badge>
          </div>
          {project.description && <p className="text-xs text-gray-600">{project.description}</p>}
        </div>

        <ProcurementStatusBar stages={stages} />

        {/* Job details */}
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-900">{t('jobOverview.jobDetails')}</p>
          <div className="divide-y divide-gray-100">
            <DetailRow
              icon={<LocationIcon className="h-4 w-4" />}
              label={t('jobOverview.location')}
            >
              {deliveryLocation ? deliveryLocation.address : notProvided}
            </DetailRow>
            <DetailRow
              icon={<UserIcon className="h-4 w-4" />}
              label={t('jobOverview.projectManager')}
            >
              {project.pointOfContact ? project.pointOfContact.name : notProvided}
            </DetailRow>
            <DetailRow
              icon={<CalendarIcon className="h-4 w-4" />}
              label={t('jobOverview.startDate')}
            >
              {project.startDate ? formatDate(project.startDate) : notProvided}
            </DetailRow>
            <DetailRow
              icon={<CalendarIcon className="h-4 w-4" />}
              label={t('jobOverview.estCompletion')}
            >
              {project.expectedEndDate ? formatDate(project.expectedEndDate) : notProvided}
            </DetailRow>
            <DetailRow icon={<UsersIcon className="h-4 w-4" />} label={t('jobOverview.crewSize')}>
              {t('jobOverview.crewSizeValue', { count: project.assignedUsers?.length ?? 0 })}
            </DetailRow>
          </div>
        </div>

        {/* Stat tiles. Only PO count is API-backed; the others are placeholders. */}
        <div className="flex gap-3">
          <StatTile value="—" label={t('jobOverview.statComplete')} />
          <StatTile value="—" label={t('jobOverview.statDaysLeft')} />
          <StatTile value={String(project.poCount ?? 0)} label={t('jobOverview.statPending')} />
        </div>
      </div>
    </MobileShell>
  );
}
