import type { InvoiceListItem, InvoiceListParams } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Badge,
  Button,
  Checkbox,
  DatePicker,
  DotActionsMenu,
  FilterPanel,
  Input,
  getStatusColor,
  INVOICE_STATUS_COLORS,
  PageLoader,
  SearchInput,
  SelectDropdown,
  SortIcon,
  TablePagination,
} from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
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
  const { t } = useTranslation('invoices');
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

  const hasActiveFilters =
    statusFilter.length > 0 || dueDateFrom || dueDateTo || amountMin || amountMax;

  const clearFilters = useCallback(() => {
    setStatusFilter([]);
    setDueDateFrom('');
    setDueDateTo('');
    setAmountMin('');
    setAmountMax('');
    setPage(1);
  }, []);

  const statusOptions = INVOICE_STATUSES.map((s) => ({
    value: s,
    label: t(`status.${s}` as never),
  }));

  if (isLoading && !data) {
    return <PageLoader />;
  }

  return (
    <div className="px-8 pt-6 pb-8">
      <div className="flex flex-col rounded-lg border border-border bg-background pb-4">
        <div className="mt-4 px-8">
          <div className="border-b border-border" />
        </div>
        <div className="px-8 pt-2 pb-4">
          {hasSelection ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircleIcon className="text-muted-foreground" />
                <span>{t('list.itemsSelected', { count: selectedIds.size })}</span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  size="md"
                  isLoading={bulkApproveMutation.isPending}
                  disabled={bulkApproveMutation.isPending}
                  onClick={() => {
                    bulkApproveMutation.mutate([...selectedIds], {
                      onSuccess: () => setSelectedIds(new Set()),
                    });
                  }}
                >
                  <CheckCircleIcon className="mr-2" />
                  {t('list.approveAll')}
                </Button>
                <ExportAsButton
                  label={t('list.exportAs')}
                  isLoading={exportMutation.isPending}
                  onExport={handleBulkExport}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <SearchInput
                className="flex-1 max-w-lg"
                iconClassName="text-foreground"
                placeholder={t('list.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <FilterPanel
                label={t('list.filters')}
                title={t('list.filters')}
                onClearAll={hasActiveFilters ? clearFilters : undefined}
                clearAllLabel={t('list.clearFilters')}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {t('filters.status')}
                    </label>
                    <SelectDropdown
                      placeholder={t('filters.allStatuses')}
                      options={statusOptions}
                      selected={statusFilter}
                      onSelectedChange={(v: string[]) => {
                        setStatusFilter(v);
                        setPage(1);
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {t('filters.dueDateFrom')}
                    </label>
                    <DatePicker
                      placeholder="From"
                      value={dueDateFrom}
                      maxDate={dueDateTo || undefined}
                      onChange={(v: string) => {
                        setDueDateFrom(v);
                        setPage(1);
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {t('filters.dueDateTo')}
                    </label>
                    <DatePicker
                      placeholder="To"
                      value={dueDateTo}
                      minDate={dueDateFrom || undefined}
                      onChange={(v: string) => {
                        setDueDateTo(v);
                        setPage(1);
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {t('filters.amountMin')}
                    </label>
                    <Input
                      className="bg-background"
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
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {t('filters.amountMax')}
                    </label>
                    <Input
                      className="bg-background"
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
              <div className="flex-1" />
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate(INVOICE_ROUTES.invoiceCreate)}
              >
                {t('list.createNew')}
              </Button>
            </div>
          )}
        </div>

        <div className="px-8">
          {isError ? (
            <div className="py-12 px-8 text-center text-destructive">{t('list.failedToLoad')}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 px-8 text-center text-muted-foreground">
              {t('list.noInvoicesFound')}
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border overflow-x-auto">
                <table className="w-full min-w-[800px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left bg-[hsl(var(--table-header))] font-['Inter'] text-[hsl(var(--table-header-foreground))]">
                      <th className="py-3 px-3 w-10">
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
                        <th
                          key={field}
                          className="py-3 px-3 text-xs font-bold leading-4 tracking-[0.6px] whitespace-nowrap cursor-pointer select-none"
                          onClick={() => handleSort(field)}
                        >
                          <span className="flex items-center justify-between gap-2">
                            {label}
                            <SortIcon
                              active={sortField === field}
                              direction={sortField === field ? sortDir : null}
                            />
                          </span>
                        </th>
                      ))}
                      <th className="py-3 px-3 text-xs font-bold leading-4 tracking-[0.6px] whitespace-nowrap text-center">
                        {t('columns.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className="border-b border-border last:border-b-0 hover:bg-accent/50 transition-colors"
                      >
                        <td className="py-3 px-3">
                          <Checkbox
                            checked={selectedIds.has(invoice.id)}
                            onChange={() => toggleOne(invoice.id)}
                          />
                        </td>
                        <td className="py-3 px-3 text-foreground">{invoice.id.slice(0, 8)}</td>
                        <td className="py-3 px-3 text-foreground truncate max-w-[180px]">
                          {invoice.projectName}
                        </td>
                        <td className="py-3 px-3 text-foreground">
                          {invoice.projectId.slice(0, 8)}
                        </td>
                        <td className="py-3 px-3 text-foreground truncate max-w-[180px]">
                          {invoice.vendorName}
                        </td>
                        <td className="py-3 px-3">
                          <Badge className={getStatusColor(INVOICE_STATUS_COLORS, invoice.status)}>
                            {t(`status.${invoice.status}` as never)}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-foreground">
                          {invoice.relatedPo ? invoice.relatedPo.slice(0, 8) : '—'}
                        </td>
                        <td className="py-3 px-3 text-foreground">
                          $
                          {invoice.totalAmount.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-3 px-3 text-foreground">
                          {invoice.dueDate
                            ? new Date(invoice.dueDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="inline-flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              title={t('actions.view')}
                              onClick={() =>
                                navigate(INVOICE_ROUTES.invoiceDetail.replace(':id', invoice.id))
                              }
                            >
                              <EyeIcon />
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                              title={t('actions.approve')}
                              disabled={approveMutation.isPending || invoice.status !== 'PENDING'}
                              onClick={() => approveMutation.mutate(invoice.id)}
                            >
                              <CheckCircleIcon />
                            </button>
                            <DotActionsMenu
                              bordered={false}
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
              {totalItems > 0 && (
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
              )}
            </>
          )}
        </div>
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
          <DownloadIcon className="w-4 h-4" />
          {label}
        </span>
      }
    />
  );
}
