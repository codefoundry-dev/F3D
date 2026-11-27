import { useTranslation } from '@forethread/i18n';
import type { ExpectedDeliveryListItem } from '@forethread/shared-types/client';
import {
  Badge,
  Button,
  FilterDropdownButton,
  SearchInput,
  Spinner,
  TablePagination,
  cn,
  formatDate,
  getStatusColor,
  EXPECTED_DELIVERY_STATUS_COLORS,
  useDebounce,
} from '@forethread/ui-components';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus-in-circle.svg?react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { usePermissions } from '@/shared/role/usePermissions';

import {
  useDeliveryProjects,
  useDeliveryVendors,
  useExpectedDeliveries,
} from '../services/deliveries.service';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

/**
 * Expected deliveries (FOR-356): every PO in a deliverable status appears here
 * automatically — no manual recreation in Deliveries — with a red Overdue flag
 * once its expected delivery date has passed. "Record delivery" jumps straight
 * into the pre-filled create-report form for that PO.
 */
export function ExpectedDeliveriesTab() {
  const { t } = useTranslation('deliveries');
  const navigate = useNavigate();
  const { has } = usePermissions();

  // ── Filters ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [vendor, setVendor] = useState<string[]>([]);
  const [project, setProject] = useState<string[]>([]);
  const [location, setLocation] = useState<string[]>([]);
  const [overdueOnly, setOverdueOnly] = useState(false);
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

  const params = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: debouncedSearch || undefined,
      vendorId: vendor[0],
      projectId: project[0],
      deliveryLocationId: location[0],
      overdue: overdueOnly || undefined,
    }),
    [page, pageSize, debouncedSearch, vendor, project, location, overdueOnly],
  );

  const { data, isLoading, isError } = useExpectedDeliveries(params);
  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const total = data?.meta?.total ?? items.length;

  // As on the Reports tab: no canonical location catalogue in the list DTO, so
  // derive the option set from the returned rows.
  const locationOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of items) {
      if (it.deliveryLocationId && it.deliveryLocationName) {
        map.set(it.deliveryLocationId, it.deliveryLocationName);
      }
    }
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [items]);

  const recordDelivery = (poId: string) => void navigate(`${ROUTES.deliveryNew}?poId=${poId}`);
  const viewPo = (poId: string) => void navigate(ROUTES.purchaseOrderDetail.replace(':id', poId));

  return (
    <div>
      {/* ═══ Toolbar ═══ */}
      <div className="mb-4 flex flex-1 flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t('expected.searchPlaceholder')}
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setOverdueOnly((v) => !v);
            setPage(1);
          }}
          aria-pressed={overdueOnly}
          className={cn(overdueOnly && 'border-destructive bg-destructive/10 text-destructive')}
          data-testid="expected-overdue-filter"
        >
          {t('expected.overdueOnly')}
        </Button>
      </div>

      {/* ═══ Cards ═══ */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : isError ? (
        <div className="py-16 text-center text-muted-foreground">{t('expected.loadFailed')}</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium text-foreground">{t('expected.empty')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('expected.emptyHint')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4" data-testid="expected-list">
          {items.map((item) => (
            <ExpectedDeliveryCard
              key={item.purchaseOrderId}
              item={item}
              canRecord={has('delivery.create')}
              onRecord={() => recordDelivery(item.purchaseOrderId)}
              onViewPo={() => viewPo(item.purchaseOrderId)}
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
    </div>
  );
}

interface ExpectedDeliveryCardProps {
  item: ExpectedDeliveryListItem;
  canRecord: boolean;
  onRecord: () => void;
  onViewPo: () => void;
}

function ExpectedDeliveryCard({ item, canRecord, onRecord, onViewPo }: ExpectedDeliveryCardProps) {
  const { t } = useTranslation('deliveries');

  return (
    <div
      className="rounded-[14px] border border-border bg-card"
      data-testid={`expected-card-${item.purchaseOrderId}`}
    >
      {/* Header row: status flags + PO number, actions on the right. Phones stack
          the actions under the PO, with Record delivery full width (FOR-380). */}
      <div className="flex flex-col gap-3 px-4 pt-4 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {item.isOverdue && (
            // Badge does not forward data-* props, so the testid lives on a wrapper.
            <span data-testid={`expected-overdue-${item.purchaseOrderId}`}>
              <Badge className={getStatusColor(EXPECTED_DELIVERY_STATUS_COLORS, 'OVERDUE')}>
                {t('expected.status.OVERDUE')}
              </Badge>
            </span>
          )}
          <Badge className={getStatusColor(EXPECTED_DELIVERY_STATUS_COLORS, item.progress)}>
            {t(`expected.status.${item.progress}` as never)}
          </Badge>
          <span className="whitespace-nowrap text-lg font-semibold text-foreground">
            {item.poNumber}
          </span>
          {item.hasPendingReport && (
            <span className="text-xs text-muted-foreground">{t('expected.pendingReport')}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canRecord && (
            <Button
              variant="primary"
              size="sm"
              className="max-md:min-h-11 max-md:flex-1"
              leftIcon={<PlusIcon className="w-4 h-4" />}
              onClick={onRecord}
              data-testid={`expected-record-${item.purchaseOrderId}`}
            >
              {t('expected.recordDelivery')}
            </Button>
          )}
          <button
            type="button"
            className="flex items-center justify-center rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground max-md:size-11"
            title={t('list.view')}
            aria-label={t('list.view')}
            data-testid={`expected-view-po-${item.purchaseOrderId}`}
            onClick={onViewPo}
          >
            <EyeIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mx-4 my-3 border-t border-border md:mx-5" />

      {/* Detail grid */}
      <div className="grid grid-cols-2 gap-y-3 px-4 pb-4 sm:grid-cols-3 md:px-5 lg:grid-cols-5">
        <div className="min-w-0 pr-3">
          <p className="text-xs text-muted-foreground">{t('expected.fields.expectedDate')}</p>
          <p
            className={cn(
              'mt-0.5 truncate text-sm font-medium',
              item.isOverdue ? 'text-destructive' : 'text-foreground',
            )}
            data-testid={`expected-date-${item.purchaseOrderId}`}
          >
            {item.expectedDeliveryDate ? formatDate(item.expectedDeliveryDate) : '-'}
          </p>
        </div>
        <CardField label={t('expected.fields.project')} value={item.projectName ?? '-'} />
        <CardField label={t('expected.fields.vendor')} value={item.vendorName ?? '-'} />
        <CardField label={t('expected.fields.location')} value={item.deliveryLocationName ?? '-'} />
        <CardField label={t('expected.fields.items')} value={String(item.itemCount)} />
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
