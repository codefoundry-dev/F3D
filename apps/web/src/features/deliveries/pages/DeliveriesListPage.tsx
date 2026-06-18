import type { PoListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import type { DeliveryReportListItem } from '@forethread/shared-types/client';
import { DeliveryReportStatus } from '@forethread/shared-types/client';
import {
  Badge,
  Button,
  FilterDropdownButton,
  SearchInput,
  Spinner,
  TablePagination,
  getStatusColor,
  DELIVERY_STATUS_COLORS,
  useDebounce,
  notificationService,
} from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus-in-circle.svg?react';
import UploadIcon from '@forethread/ui-components/assets/icons/upload.svg?react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { usePermissions } from '@/shared/role/usePermissions';

import { RejectDeliveryModal } from '../components/RejectDeliveryModal';
import { SelectPoModal } from '../components/SelectPoModal';
import { DELIVERY_STATUS_FILTER_OPTIONS, formatDeliveryDateTime } from '../constants';
import {
  useApproveDeliveryReport,
  useDeliveryProjects,
  useDeliveryReports,
  useDeliveryVendors,
  useRejectDeliveryReport,
} from '../services/deliveries.service';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

/**
 * Deliveries management list (screenshot 01). Search + Vendor/Status/Project/
 * Location filters + Create new / Upload, over a list of report cards. SUBMITTED
 * cards expose inline Approve / Reject (revealed on hover, screenshot 16).
 */
export default function DeliveriesListPage() {
  const { t } = useTranslation('deliveries');
  const navigate = useNavigate();
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const { has } = usePermissions();

  useEffect(() => {
    setPageTitle(t('list.title'), t('list.subtitle'));
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [vendor, setVendor] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const [project, setProject] = useState<string[]>([]);
  const [location, setLocation] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: vendors } = useDeliveryVendors();
  const { data: projects } = useDeliveryProjects();

  const vendorOptions = useMemo(
    () => (vendors ?? []).map((v) => ({ value: v.id, label: v.tradeName ?? v.legalName })),
    [vendors],
  );
  const projectOptions = useMemo(
    () => (projects ?? []).map((p) => ({ value: p.id, label: p.name })),
    [projects],
  );
  // The list DTO has no canonical location catalogue; derive the option set from
  // the returned reports so the filter still works against real data.
  const statusOptions = useMemo(
    () => DELIVERY_STATUS_FILTER_OPTIONS.map((s) => ({ value: s, label: t(`status.${s}`) })),
    [t],
  );

  const params = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: debouncedSearch || undefined,
      vendor: vendor[0],
      status: status[0],
      project: project[0],
      location: location[0],
    }),
    [page, pageSize, debouncedSearch, vendor, status, project, location],
  );

  const { data, isLoading, isError } = useDeliveryReports(params);
  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const total = data?.meta?.total ?? items.length;

  const locationOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of items) {
      if (it.deliveryLocationId && it.deliveryLocationName) {
        map.set(it.deliveryLocationId, it.deliveryLocationName);
      }
    }
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [items]);

  // ── Review actions ─────────────────────────────────────────────────────────
  const approveMutation = useApproveDeliveryReport();
  const rejectMutation = useRejectDeliveryReport();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [showSelectPo, setShowSelectPo] = useState(false);

  const handleApprove = (id: string) =>
    approveMutation.mutate(id, {
      onSuccess: () => notificationService.success(t('review.approved')),
      onError: () => notificationService.error(t('review.approveFailed')),
    });

  const handleReject = (reason: string) => {
    if (!rejectId) return;
    rejectMutation.mutate(
      { id: rejectId, reason },
      {
        onSuccess: () => {
          notificationService.success(t('review.rejected'));
          setRejectId(null);
        },
        onError: () => notificationService.error(t('review.rejectFailed')),
      },
    );
  };

  const goToDetail = (id: string) => navigate(ROUTES.deliveryDetail.replace(':id', id));

  return (
    <div className="px-4 pb-6 pt-4 sm:px-8 sm:pb-8 sm:pt-6">
      {/* ═══ Toolbar ═══ */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('list.searchPlaceholder')}
            className="w-full sm:w-[260px]"
          />
          <FilterDropdownButton
            label={t('list.filters.vendor')}
            popoverTitle={t('list.filters.vendor')}
            options={vendorOptions}
            selected={vendor}
            onChange={(v) => {
              setVendor(v.slice(-1));
              setPage(1);
            }}
            buttonClassName="w-auto min-w-[120px]"
          />
          <FilterDropdownButton
            label={t('list.filters.status')}
            popoverTitle={t('list.filters.status')}
            options={statusOptions}
            selected={status}
            onChange={(v) => {
              setStatus(v.slice(-1));
              setPage(1);
            }}
            hideSearch
            buttonClassName="w-auto min-w-[120px]"
          />
          <FilterDropdownButton
            label={t('list.filters.project')}
            popoverTitle={t('list.filters.project')}
            options={projectOptions}
            selected={project}
            onChange={(v) => {
              setProject(v.slice(-1));
              setPage(1);
            }}
            buttonClassName="w-auto min-w-[120px]"
          />
          <FilterDropdownButton
            label={t('list.filters.location')}
            popoverTitle={t('list.filters.location')}
            options={locationOptions}
            selected={location}
            onChange={(v) => {
              setLocation(v.slice(-1));
              setPage(1);
            }}
            buttonClassName="w-auto min-w-[120px]"
          />
        </div>

        <div className="flex items-center gap-3">
          {has('delivery.create') && (
            <Button
              variant="primary"
              leftIcon={<PlusIcon className="w-[18px] h-[18px]" />}
              onClick={() => setShowSelectPo(true)}
              data-testid="delivery-create-new"
            >
              {t('list.createNew')}
            </Button>
          )}
          {/* Upload: stubbed secondary action — opens the PO picker so an
              externally-prepared report could be attached to a PO. Flagged for
              confirmation (no dedicated upload endpoint exists yet). */}
          <Button
            variant="outline"
            leftIcon={<UploadIcon className="w-[18px] h-[18px]" />}
            onClick={() => setShowSelectPo(true)}
            data-testid="delivery-upload"
          >
            {t('list.upload')}
          </Button>
        </div>
      </div>

      {/* ═══ Cards ═══ */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : isError ? (
        <div className="py-16 text-center text-muted-foreground">{t('list.loadFailed')}</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium text-foreground">{t('list.empty')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('list.emptyHint')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4" data-testid="delivery-list">
          {items.map((report) => (
            <DeliveryCard
              key={report.id}
              report={report}
              canReview={has('delivery.read')}
              isApproving={approveMutation.isPending}
              onView={() => goToDetail(report.id)}
              onApprove={() => handleApprove(report.id)}
              onReject={() => setRejectId(report.id)}
            />
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="mt-2">
          <TablePagination
            page={page}
            totalItems={total}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            rowsPerPageLabel={t('list.rowsPerPage')}
            showingLabel={({ from, to, total: tot }) => t('list.showing', { from, to, total: tot })}
          />
        </div>
      )}

      {rejectId && (
        <RejectDeliveryModal
          onClose={() => setRejectId(null)}
          onConfirm={handleReject}
          isSubmitting={rejectMutation.isPending}
        />
      )}

      <SelectPoModal
        open={showSelectPo}
        onClose={() => setShowSelectPo(false)}
        onSelect={(po: PoListItem) => {
          setShowSelectPo(false);
          navigate(`${ROUTES.deliveryNew}?poId=${po.id}`);
        }}
      />
    </div>
  );
}

interface DeliveryCardProps {
  report: DeliveryReportListItem;
  canReview: boolean;
  isApproving: boolean;
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
}

function DeliveryCard({
  report,
  canReview,
  isApproving,
  onView,
  onApprove,
  onReject,
}: DeliveryCardProps) {
  const { t } = useTranslation('deliveries');
  const isSubmitted = report.status === DeliveryReportStatus.SUBMITTED;

  return (
    <div
      className="group rounded-[14px] border border-border bg-card"
      data-testid={`delivery-card-${report.id}`}
    >
      {/* Header row: status + PO number, actions on the right */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <div className="flex items-center gap-3">
          <Badge className={getStatusColor(DELIVERY_STATUS_COLORS, report.status)}>
            {t(`status.${report.status}` as never)}
          </Badge>
          <span className="text-lg font-semibold text-foreground">
            {report.poNumber ?? report.reportNumber}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isSubmitted && canReview && (
            <div className="hidden items-center gap-2 group-hover:flex">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<CheckCircleIcon className="w-4 h-4" />}
                isLoading={isApproving}
                onClick={onApprove}
                data-testid={`delivery-approve-${report.id}`}
              >
                {t('list.approve')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<CrossInCircleIcon className="w-4 h-4" />}
                onClick={onReject}
                data-testid={`delivery-reject-${report.id}`}
              >
                {t('list.reject')}
              </Button>
            </div>
          )}
          <button
            type="button"
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t('list.view')}
            aria-label={t('list.view')}
            data-testid={`delivery-view-${report.id}`}
            onClick={onView}
          >
            <EyeIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mx-5 my-3 border-t border-border" />

      {/* Detail grid */}
      <div className="grid grid-cols-2 gap-y-3 px-5 pb-4 sm:grid-cols-3 lg:grid-cols-6">
        <CardField label={t('list.fields.deliveryDate')} value={formatDeliveryDateTime(report.deliveryDate)} />
        <CardField label={t('list.fields.project')} value={report.projectName ?? '-'} />
        <CardField label={t('list.fields.vendor')} value={report.vendorName ?? '-'} />
        <CardField label={t('list.fields.location')} value={report.deliveryLocationName ?? '-'} />
        <CardField label={t('list.fields.linkedRfq')} value={report.linkedRfqNumber ?? '-'} />
        <CardField label={t('list.fields.invoice')} value={report.invoiceNumber ?? '-'} />
      </div>
    </div>
  );
}

function CardField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 pr-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground" title={value}>
        {value}
      </p>
    </div>
  );
}
