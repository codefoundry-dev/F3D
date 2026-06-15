import type { MrListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Button,
  FilterChip,
  formatDate,
  Spinner,
  TablePagination,
} from '@forethread/ui-components';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { useMaterialRequests } from '../../services/material-requests.service';
import { MrPriorityBadge, MrStatusBadge } from '../components/MrStatusBadge';
import {
  applyClientQuickFilter,
  MR_QUICK_FILTERS,
  quickFilterToParams,
  type MrQuickFilter,
} from '../utils/quickFilters';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

/**
 * Officer-facing Material Request dashboard (US 2.08). Procurement Officers /
 * Company Admins review raised MRs here and drill into a detail page to approve,
 * decline, or convert. Built on the shared design-token component system used by
 * the PO/RFQ dashboards (lean subset: toolbar + quick-filter chips + static
 * table + client-side pagination — no grouping / saved views / advanced filters).
 */
export default function OfficerDashboardPage() {
  const { t } = useTranslation('materialRequests');
  const navigate = useNavigate();

  const [quickFilter, setQuickFilter] = useState<MrQuickFilter | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Server-backed quick filters become request params; client-side ones
  // (dueToday / recentlyUpdated) are applied to the returned items below.
  const params = useMemo(() => quickFilterToParams(quickFilter), [quickFilter]);
  const { data, isLoading, isError } = useMaterialRequests(params);

  const items = useMemo(
    () => applyClientQuickFilter(data?.items ?? [], quickFilter),
    [data?.items, quickFilter],
  );

  const totalCount = items.length;
  const pagedItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  const goToDetail = (id: string) => navigate(ROUTES.materialRequestDetail.replace(':id', id));

  return (
    <div className="relative px-4 pb-6 pt-4 sm:px-8 sm:pb-8 sm:pt-6">
      {/* ═══ Title row ═══ */}
      <div className="mb-3 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-xl font-semibold text-foreground">{t('officer.title')}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<span className="text-base leading-none">+</span>}
            onClick={() => navigate(ROUTES.materialRequestJobs)}
            data-testid="mr-officer-create"
          >
            {t('officer.create')}
          </Button>
          {/* US 2.08 follow-up: no MR export endpoint exists in api-client yet —
              the button is disabled until backend support lands. */}
          <Button variant="outline" size="sm" disabled title={t('officer.export')}>
            {t('officer.export')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col rounded-lg border border-border bg-background pb-4">
        {/* ═══ Quick filters ═══ */}
        <div className="px-4 pt-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="whitespace-nowrap text-sm text-muted-foreground">
              {t('officer.quickFiltersLabel')}
            </span>
            {MR_QUICK_FILTERS.map((key) => (
              <FilterChip
                key={key}
                label={t(`officer.quickFilters.${key}` as never)}
                active={quickFilter === key}
                onClick={() => {
                  setQuickFilter(quickFilter === key ? '' : key);
                  setPage(1);
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 px-4 sm:px-6">
          <div className="border-b border-border" />
        </div>

        {/* ═══ Table ═══ */}
        <div className="px-4 pt-4 sm:px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="md" />
            </div>
          ) : isError ? (
            <div className="py-12 text-center text-muted-foreground">{t('officer.loadFailed')}</div>
          ) : totalCount === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-foreground">{t('officer.empty')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('officer.emptyHint')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm" data-testid="mr-officer-table">
                <thead>
                  <tr className="border-b border-border bg-[hsl(var(--table-header))] text-left text-[hsl(var(--table-header-foreground))]">
                    {/* US 2.08 follow-up: the Figma also shows "Request type"
                        (Project/Warehouse) and a list-level "Delivery location"
                        column. Both are deferred — "Request type" has no backend
                        field (future Epic-7 warehouse-inventory concept) and
                        "Delivery location" is only on MrDetail, not MrListItem. */}
                    {(
                      [
                        'mrNumber',
                        'project',
                        'requestedBy',
                        'priority',
                        'status',
                        'neededBy',
                        'items',
                      ] as const
                    ).map((col) => (
                      <th
                        key={col}
                        className="whitespace-nowrap px-3 py-3 text-xs font-bold leading-4 tracking-[0.6px]"
                      >
                        {t(`officer.columns.${col}` as never)}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-xs font-bold leading-4 tracking-[0.6px]">
                      {t('officer.columns.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedItems.map((mr) => (
                    <MrRow key={mr.id} mr={mr} onView={() => goToDetail(mr.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalCount > 0 && (
          <div className="px-4 sm:px-6">
            <TablePagination
              page={page}
              totalItems={totalCount}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              rowsPerPageLabel={t('officer.rowsPerPage')}
              showingLabel={({ from, to, total }) => t('officer.showing', { from, to, total })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MrRow({ mr, onView }: { mr: MrListItem; onView: () => void }) {
  const { t } = useTranslation('materialRequests');
  return (
    <tr
      className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-accent/50"
      onClick={onView}
    >
      <td className="px-3 py-3 font-medium text-foreground">{mr.mrNumber}</td>
      <td className="max-w-[220px] truncate px-3 py-3 text-foreground">{mr.project.name}</td>
      <td className="px-3 py-3 text-foreground">{mr.requestedBy.name}</td>
      <td className="px-3 py-3">
        <MrPriorityBadge priority={mr.priority} />
      </td>
      <td className="px-3 py-3">
        <MrStatusBadge status={mr.status} />
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-foreground">
        {mr.neededByDate ? formatDate(mr.neededByDate) : t('officer.noDate')}
      </td>
      <td className="px-3 py-3 text-foreground">{mr.lineItemCount}</td>
      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={t('officer.view')}
          aria-label={t('officer.view')}
          data-testid={`mr-view-${mr.id}`}
          onClick={onView}
        >
          <EyeIcon className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
