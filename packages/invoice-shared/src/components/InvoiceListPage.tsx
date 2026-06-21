import type { InvoiceListItem, InvoiceListParams } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import {
  Badge,
  Button,
  Checkbox,
  DateRangeFilterDropdown,
  DotActionsMenu,
  EmptyState,
  EmptyBoxIllustration,
  SearchEmptyIllustration,
  FilterPanel,
  FilterPopover,
  FilterTag,
  Input,
  getStatusColor,
  INVOICE_STATUS_COLORS,
  PageLoader,
  SearchInput,
  SortIcon,
  Spinner,
  TablePagination,
} from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import InvoiceIcon from '@forethread/ui-components/assets/icons/invoice.svg?react';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { INVOICE_ROUTES } from '../constants/routes';

import {
  useInvoices,
  useApproveInvoice,
  useBulkApproveInvoices,
  useExportInvoices,
  useExportSingleInvoice,
} from '../hooks/useInvoices';

/** Allow only digits, one dot, and navigation/editing keys */
const ALLOWED_KEYS = new Set([
  'Backspace',
  'Delete',
  'Tab',
  'Escape',
  'Enter',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
]);

function blockNonNumericKey(e: React.KeyboardEvent<HTMLInputElement>) {
  if (ALLOWED_KEYS.has(e.key)) return;
  if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z'].includes(e.key)) return;
  if (e.key === '.' && !e.currentTarget.value.includes('.')) return;
  if (/^\d$/.test(e.key)) return;
  e.preventDefault();
}

function sanitizeNumericPaste(e: React.ClipboardEvent<HTMLInputElement>) {
  const pasted = e.clipboardData.getData('text');
  if (!/^\d*\.?\d*$/.test(pasted)) {
    e.preventDefault();
  }
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const INVOICE_STATUSES = ['PENDING', 'APPROVED', 'DISPUTED', 'PAID', 'REJECTED'] as const;

type SortableField =
  | 'id'
  | 'projectName'
  | 'projectId'
  | 'vendorName'
  | 'status'
  | 'relatedPo'
  | 'totalAmount'
  | 'dueDate';

export interface InvoiceListPageProps {
  /** Extra cache keys to invalidate on approve/reject (e.g. FO dashboard) */
  extraInvalidateKeys?: string[][];
}

export function InvoiceListPage({ extraInvalidateKeys }: InvoiceListPageProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const navigate = useNavigate();
  const approveMutation = useApproveInvoice(extraInvalidateKeys);
  const bulkApproveMutation = useBulkApproveInvoices(extraInvalidateKeys);
  const exportMutation = useExportInvoices();
  const exportSingleMutation = useExportSingleInvoice();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortableField | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // App-bar breadcrumb / page title
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('list.title'), null, null, [{ label: t('list.title') }]);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  // Debounce search
  useEffect(() => {
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [search]);

  const params = useMemo<InvoiceListParams>(
    () => ({
      page,
      limit: pageSize,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(statusFilter.length === 1 ? { status: statusFilter[0] } : {}),
      ...(dueDateFrom ? { dueDateFrom } : {}),
      ...(dueDateTo ? { dueDateTo } : {}),
      ...(amountMin ? { amountMin: Number(amountMin) } : {}),
      ...(amountMax ? { amountMax: Number(amountMax) } : {}),
      ...(sortField ? { sortBy: sortField, sortDir } : {}),
    }),
    [
      page,
      pageSize,
      debouncedSearch,
      statusFilter,
      dueDateFrom,
      dueDateTo,
      amountMin,
      amountMax,
      sortField,
      sortDir,
    ],
  );

  const { data, isLoading, isError } = useInvoices(params);
  const items: InvoiceListItem[] = data?.items ?? [];
  const totalItems = data?.meta?.total ?? 0;

  const handleSort = useCallback(
    (field: SortableField) => {
      setSortDir((prev) => (sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
      setSortField(field);
      setPage(1);
    },
    [sortField],
  );

  // Client-side multi-status filter (backend only accepts single status)
  const filtered = items.filter((inv) => {
    if (statusFilter.length > 1 && !statusFilter.includes(inv.status)) return false;
    return true;
  });

  const allSelected = filtered.length > 0 && filtered.every((inv) => selectedIds.has(inv.id));
  const hasSelection = selectedIds.size > 0;

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        filtered.forEach((inv) => next.delete(inv.id));
      } else {
        filtered.forEach((inv) => next.add(inv.id));
      }
      return next;
    });
  }, [allSelected, filtered]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkExport = useCallback(
    (format: 'csv' | 'xlsx' | 'pdf') => {
      const idsParam = hasSelection ? [...selectedIds].join(',') : undefined;
      exportMutation.mutate(
        { format, params: { ...params, ...(idsParam ? { ids: idsParam } : {}) } },
        {
          onSuccess: (result) => {
            window.open(result.url, '_blank');
          },
        },
      );
    },
    [exportMutation, params, hasSelection, selectedIds],
  );

  const handleSingleExport = useCallback(
    (id: string) => {
      exportSingleMutation.mutate(
        { id, format: 'pdf' },
        {
          onSuccess: (result) => {
            window.open(result.url, '_blank');
          },
        },
      );
    },
    [exportSingleMutation],
  );

  const hasActiveFilters = Boolean(
    statusFilter.length || dueDateFrom || dueDateTo || amountMin || amountMax,
  );

  const clearAmount = useCallback(() => {
    setAmountMin('');
    setAmountMax('');
    setPage(1);
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setStatusFilter([]);
    setDueDateFrom('');
    setDueDateTo('');
    setAmountMin('');
    setAmountMax('');
    setSearch('');
    setPage(1);
  }, []);

  const statusOptions = INVOICE_STATUSES.map((s) => ({
    value: s,
    label: t(`status.${s}` as never),
  }));

  // ── Active-filter chips ──
  const formatChipDate = (value: string) =>
    new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  const dateChipLabel =
    dueDateFrom && dueDateTo
      ? `${formatChipDate(dueDateFrom)} - ${formatChipDate(dueDateTo)}`
      : dueDateFrom
        ? `${t('filters.from')}: ${formatChipDate(dueDateFrom)}`
        : dueDateTo
          ? `${t('filters.to')}: ${formatChipDate(dueDateTo)}`
          : '';
  const amountChipLabel =
    amountMin && amountMax
      ? `$${amountMin} - $${amountMax}`
      : amountMin
        ? `${t('filters.amountMin')}: $${amountMin}`
        : amountMax
          ? `${t('filters.amountMax')}: $${amountMax}`
          : '';

  const activeFilterChips: { key: string; label: string; onRemove: () => void }[] = [
    ...statusFilter.map((value) => ({
      key: `status-${value}`,
      label: statusOptions.find((o) => o.value === value)?.label ?? value,
      onRemove: () => {
        setStatusFilter((prev) => prev.filter((v) => v !== value));
        setPage(1);
      },
    })),
    ...(dueDateFrom || dueDateTo
      ? [
          {
            key: 'date-range',
            label: dateChipLabel,
            onRemove: () => {
              setDueDateFrom('');
              setDueDateTo('');
              setPage(1);
            },
          },
        ]
      : []),
    ...(amountMin || amountMax
      ? [{ key: 'amount-range', label: amountChipLabel, onRemove: clearAmount }]
      : []),
  ];

  const countLabel = debouncedSearch
    ? t('list.searchingLabel', { total: totalItems })
    : hasActiveFilters
      ? t('list.showingLabel', { total: totalItems })
      : t('list.totalLabel', { total: totalItems });

  if (isLoading && !data) {
    return <PageLoader />;
  }

  return (
    <div className="flex flex-1 flex-col gap-3 px-6 py-4">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white p-px text-gray-700 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]">
            <InvoiceIcon className="size-[15px]" />
          </span>
          <h1 className="text-[20px] font-medium leading-[1.4] tracking-[0.3px] text-gray-900">
            {t('list.title')}
          </h1>
        </div>
        <Button variant="primary" onClick={() => navigate(INVOICE_ROUTES.invoiceCreate)}>
          {t('list.createNew')}
        </Button>
      </div>

      {/* ── Card: toolbar + table ── */}
      <div className="flex flex-1 flex-col gap-4 rounded-[18px] border border-gray-100 bg-[#F9F9FA] p-3 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
        {/* Toolbar */}
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-2">
          {/* Left: selection actions OR result count + chips */}
          <div className="flex min-h-[34px] min-w-0 flex-1 flex-wrap items-center gap-2 px-2">
            {hasSelection ? (
              <>
                <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <CheckCircleIcon className="size-4 text-gray-500" />
                  {t('list.itemsSelected', { count: selectedIds.size })}
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={bulkApproveMutation.isPending}
                  disabled={bulkApproveMutation.isPending}
                  leftIcon={<CheckCircleIcon className="size-4" />}
                  onClick={() =>
                    bulkApproveMutation.mutate([...selectedIds], {
                      onSuccess: () => setSelectedIds(new Set()),
                    })
                  }
                >
                  {t('list.approveAll')}
                </Button>
                <ExportAsButton
                  label={t('list.exportAs')}
                  isLoading={exportMutation.isPending}
                  onExport={handleBulkExport}
                />
              </>
            ) : (
              <>
                <p className="text-sm font-medium leading-[1.4] tracking-[0.3px] text-gray-700">
                  {countLabel}
                </p>
                {(hasActiveFilters || debouncedSearch) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    rightIcon={<CrossIcon className="size-3.5" />}
                    onClick={handleClearAllFilters}
                  >
                    {t('filters.clearAll')}
                  </Button>
                )}
                {activeFilterChips.map((chip) => (
                  <FilterTag
                    key={chip.key}
                    label={chip.label}
                    onRemove={chip.onRemove}
                    removeLabel={t('filters.removeFilter', { label: chip.label })}
                  />
                ))}
              </>
            )}
          </div>

          {/* Right: filter dropdowns + search */}
          <div className="flex min-h-[34px] flex-wrap items-center justify-end gap-2">
            <FilterPopover
              label={t('filters.status')}
              popoverTitle={t('filters.status')}
              clearLabel={t('filters.clear')}
              options={statusOptions}
              selected={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            />
            <DateRangeFilterDropdown
              label={t('filters.date')}
              clearLabel={t('filters.clear')}
              dateFrom={dueDateFrom}
              dateTo={dueDateTo}
              fromPlaceholder={t('filters.from')}
              toPlaceholder={t('filters.to')}
              onChangeFrom={(d) => {
                setDueDateFrom(d);
                setPage(1);
              }}
              onChangeTo={(d) => {
                setDueDateTo(d);
                setPage(1);
              }}
              onClear={() => {
                setDueDateFrom('');
                setDueDateTo('');
                setPage(1);
              }}
            />
            <FilterPanel
              label={t('filters.amount')}
              title={t('filters.amount')}
              onClearAll={amountMin || amountMax ? clearAmount : undefined}
              clearAllLabel={t('filters.clear')}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-500">
                    {t('filters.amountMin')}
                  </label>
                  <Input
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amountMin}
                    onKeyDown={blockNonNumericKey}
                    onPaste={sanitizeNumericPaste}
                    onChange={(e) => {
                      setAmountMin(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-500">
                    {t('filters.amountMax')}
                  </label>
                  <Input
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amountMax}
                    onKeyDown={blockNonNumericKey}
                    onPaste={sanitizeNumericPaste}
                    onChange={(e) => {
                      setAmountMax(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
            </FilterPanel>
            <SearchInput
              className="w-[220px]"
              placeholder={t('list.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : isError ? (
          <div className="flex h-48 items-center justify-center text-sm text-destructive">
            {t('list.failedToLoad')}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-[10px] border border-gray-100 bg-white shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
            {hasActiveFilters || debouncedSearch ? (
              <EmptyState
                illustration={<SearchEmptyIllustration />}
                titleClassName="text-[24px]"
                title={t('list.noResultsTitle')}
                description={t('list.adjustFilters')}
              />
            ) : (
              <EmptyState
                illustration={<EmptyBoxIllustration />}
                title={t('list.noInvoicesFound')}
                description={t('list.createFirstInvoice')}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="overflow-hidden rounded-[10px] border border-gray-100 bg-white shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-[#F9F9FA]">
                      <th className="h-9 w-10 px-3 text-left align-middle">
                        <Checkbox checked={allSelected} onChange={toggleAll} />
                      </th>
                      {(
                        [
                          ['id', t('columns.invoiceId')],
                          ['projectName', t('columns.projectName')],
                          ['projectId', t('columns.projectId')],
                          ['vendorName', t('columns.vendorName')],
                          ['status', t('columns.status')],
                          ['relatedPo', t('columns.relatedPo')],
                          ['totalAmount', t('columns.totalAmount')],
                          ['dueDate', t('columns.dueDate')],
                        ] as const
                      ).map(([field, label]) => (
                        <th key={field} className="h-9 px-2 text-left align-middle">
                          <button
                            type="button"
                            onClick={() => handleSort(field)}
                            className="inline-flex items-center gap-1 px-1 font-semibold text-gray-500 transition-colors hover:text-gray-700"
                          >
                            {label}
                            <SortIcon
                              active={sortField === field}
                              direction={sortField === field ? sortDir : null}
                            />
                          </button>
                        </th>
                      ))}
                      <th className="h-9 px-2 text-center align-middle">
                        <span className="px-1 font-semibold text-gray-500">
                          {t('columns.actions')}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-25"
                      >
                        <td className="px-3 align-middle">
                          <Checkbox
                            checked={selectedIds.has(invoice.id)}
                            onChange={() => toggleOne(invoice.id)}
                          />
                        </td>
                        <td className="h-[46px] px-2 align-middle">
                          <span className="block px-1 font-medium text-gray-800">
                            {invoice.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="max-w-[180px] px-2 align-middle">
                          <span className="block truncate px-1 font-medium text-gray-800">
                            {invoice.projectName}
                          </span>
                        </td>
                        <td className="px-2 align-middle">
                          <span className="block px-1 font-medium text-gray-800">
                            {invoice.projectCode}
                          </span>
                        </td>
                        <td className="max-w-[180px] px-2 align-middle">
                          <span className="block truncate px-1 font-medium text-gray-800">
                            {invoice.vendorName}
                          </span>
                        </td>
                        <td className="px-2 align-middle">
                          <Badge className={getStatusColor(INVOICE_STATUS_COLORS, invoice.status)}>
                            {t(`status.${invoice.status}` as never)}
                          </Badge>
                        </td>
                        <td className="px-2 align-middle">
                          <span className="block px-1 font-medium text-gray-800">
                            {invoice.relatedPo ? invoice.relatedPo.slice(0, 8) : '—'}
                          </span>
                        </td>
                        <td className="px-2 align-middle">
                          <span className="block px-1 font-medium text-gray-800">
                            $
                            {invoice.totalAmount.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </td>
                        <td className="px-2 align-middle">
                          <span className="block px-1 font-medium text-gray-800">
                            {invoice.dueDate
                              ? new Date(invoice.dueDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </span>
                        </td>
                        <td className="px-2 align-middle">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white text-gray-600 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)] transition-colors hover:bg-none hover:bg-gray-50 hover:text-gray-900"
                              title={t('actions.view')}
                              onClick={() =>
                                navigate(INVOICE_ROUTES.invoiceDetail.replace(':id', invoice.id))
                              }
                            >
                              <EyeIcon className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white text-gray-600 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)] transition-colors hover:bg-none hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
                              title={t('actions.approve')}
                              disabled={approveMutation.isPending || invoice.status !== 'PENDING'}
                              onClick={() => approveMutation.mutate(invoice.id)}
                            >
                              <CheckCircleIcon className="size-3.5" />
                            </button>
                            <DotActionsMenu
                              bordered={false}
                              triggerClassName="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white text-gray-600 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)] transition-colors hover:bg-none hover:bg-gray-50 hover:text-gray-900"
                              actions={[
                                ...(invoice.status === 'PENDING'
                                  ? [
                                      {
                                        key: 'approve',
                                        label: t('actions.approve'),
                                        onClick: () => approveMutation.mutate(invoice.id),
                                      },
                                    ]
                                  : []),
                                {
                                  key: 'export-pdf',
                                  label: t('actions.exportAs') + ' PDF',
                                  onClick: () => handleSingleExport(invoice.id),
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {totalItems > 0 && (
              <div className="pt-1">
                <TablePagination
                  page={page}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  rowsPerPageLabel={t('list.rowsPerPage')}
                  showingLabel={({ from, to, total }) => t('list.showing', { from, to, total })}
                  backLabel={t('pagination.back')}
                  nextLabel={t('pagination.next')}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** "Export As" button with format dropdown */
function ExportAsButton({
  label,
  isLoading,
  onExport,
}: {
  label: string;
  isLoading: boolean;
  onExport: (format: 'csv' | 'xlsx' | 'pdf') => void;
}) {
  return (
    <DotActionsMenu
      triggerClassName="bg-foreground text-background hover:bg-foreground/90 hover:text-background border-foreground"
      actions={[
        { key: 'pdf', label: 'PDF', onClick: () => onExport('pdf'), disabled: isLoading },
        { key: 'csv', label: 'CSV', onClick: () => onExport('csv'), disabled: isLoading },
        { key: 'xlsx', label: 'XLSX', onClick: () => onExport('xlsx'), disabled: isLoading },
      ]}
      trigger={
        <span className="flex items-center gap-2">
          <DownloadIcon className="h-4 w-4" />
          {label}
        </span>
      }
    />
  );
}
