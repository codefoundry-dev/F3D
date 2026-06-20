import {
  approveQuote,
  createBulkOrder,
  createPurchaseOrder,
  declineQuote,
  type QuoteComparisonCell,
  type QuoteComparisonRow,
  type QuoteComparisonVendor,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Badge,
  Button,
  MessageBadgeIcon,
  Spinner,
  cn,
  formatCurrency,
  toast,
} from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import EyeClosedIcon from '@forethread/ui-components/assets/icons/eye-closed.svg?react';
import EyeOpenedIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import PlusInCircleIcon from '@forethread/ui-components/assets/icons/plus-in-circle.svg?react';
import SettingsIcon from '@forethread/ui-components/assets/icons/settings.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { PO_CREATE_ROUTE, RFQ_ROUTES } from '../constants/routes';
import { useDropdown } from '../hooks/useDropdown';
import {
  useCreateDraftPoFromQuote,
  useRfqQuoteComparison,
  useUpdateQuoteLineItemStatuses,
} from '../hooks/useRfqs';

import { SortingDropdown, type QuoteSortOrder } from './SortingDropdown';
import { StartOrderModal, type StartOrderKind } from './StartOrderModal';
import {
  TableManagementModal,
  DEFAULT_COLUMN_VISIBILITY,
  type ComparisonColumnVisibility,
} from './TableManagementModal';

// ── Design tokens (sampled from the 5.06 Figma frames) ─────────────────────────

const ROW_BEST_PRICE_BG = 'bg-[#E5F6EB]';
const ROW_SUBSTITUTE_BG = 'bg-[#FFF2B5]';
const ROW_SELECTED_BG = 'bg-[#C9EAFB]';
const NOT_QUOTED_BG = 'bg-[#E8EAED]';
const GROUP_HEADER_BG = 'bg-[#E1E1E1]';
const SUBTOTAL_BG = 'bg-[#F4F4F6]';
const TABLE_HEAD_BG = 'bg-[#F2F2F2]';

// ── Inline icons not present in the shared icon set ────────────────────────────

function TagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" fill="none" className={className}>
      <path
        d="M2.25 8.25V3.187a.937.937 0 0 1 .937-.937H8.25c.249 0 .487.099.663.274l6.188 6.188a.937.937 0 0 1 0 1.326l-5.063 5.064a.937.937 0 0 1-1.326 0L2.524 8.913a.937.937 0 0 1-.274-.663Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="5.625" cy="5.625" r="0.9" fill="currentColor" />
    </svg>
  );
}

function RepeatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M11.333 2 14 4.667l-2.667 2.666M14 4.667H4.667A2.667 2.667 0 0 0 2 7.333v.667M4.667 14 2 11.333l2.667-2.666M2 11.333h9.333A2.667 2.667 0 0 0 14 8.667V8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RestoreIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M5.333 6.667H2V3.333"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.682 10A6 6 0 1 0 3.515 4.6L2 6.667"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WarningCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" fill="none" className={className}>
      <circle cx="9" cy="9" r="6.75" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 5.8v3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="9" cy="12.1" r="0.85" fill="currentColor" />
    </svg>
  );
}

function CollapseAllIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M2 8h12M8 1.5v3l2-1.5M8 4.5 6 3M8 14.5v-3l2 1.5m-2-1.5L6 13"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type QuoteStatusFilter = 'all' | 'approved' | 'declined';

interface SelectedLine {
  quoteLineItemId: string;
  quoteResponseId: string;
  vendorId: string;
  projectId: string;
}

export interface QuoteComparisonTableProps {
  rfqId: string;
  layout?: 'page' | 'panel';
  statusFilter: QuoteStatusFilter;
  onStatusFilterChange: (filter: QuoteStatusFilter) => void;
  sortOrder: QuoteSortOrder;
  onSortOrderChange: (order: QuoteSortOrder) => void;
  /** Rendered inside the panel toolbar next to the table controls (view toggle). */
  toggleSlot?: ReactNode;
  /** Quote counts for the status filter chips (from the RFQ detail payload). */
  statusCounts: Record<QuoteStatusFilter, number>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function cellDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US');
}

function footerDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function discountText(cell: QuoteComparisonCell, currency: string): string {
  if (cell.discount === null) return '-';
  return cell.discountType === 'AMOUNT'
    ? formatCurrency(cell.discount, currency)
    : `${cell.discount}%`;
}

function quoteIsPending(status: string): boolean {
  const s = status.toUpperCase();
  return s === 'PENDING' || s === 'SUBMITTED';
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * US 5.06 / 5.19 — side-by-side review of vendor quotes. Rows are RFQ line
 * items (groupable by project), columns are vendors; the buyer approves or
 * declines whole quotes from the footer and individual lines from the Actions
 * column, restores declined lines, and turns approved lines into a PO or bulk
 * order.
 */
export function QuoteComparisonTable({
  rfqId,
  layout = 'page',
  statusFilter,
  onStatusFilterChange,
  sortOrder,
  onSortOrderChange,
  toggleSlot,
  statusCounts,
}: QuoteComparisonTableProps) {
  const isPanel = layout === 'panel';
  const { t } = useTranslation('rfqs');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useRfqQuoteComparison(rfqId);

  const [columnVisibility, setColumnVisibility] =
    useState<ComparisonColumnVisibility>(DEFAULT_COLUMN_VISIBILITY);
  const [showTableManagement, setShowTableManagement] = useState(false);
  const [groupByProject, setGroupByProject] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [hiddenVendors, setHiddenVendors] = useState<Set<string>>(new Set());
  const [pinnedVendor, setPinnedVendor] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Map<string, SelectedLine>>(new Map());
  const [orderQuantities, setOrderQuantities] = useState<Map<string, string>>(new Map());
  const [openNoteCell, setOpenNoteCell] = useState<string | null>(null);
  const [startOrder, setStartOrder] = useState<StartOrderKind | null>(null);
  /** Quote that was just approved from the footer — drives the post-approve PO prompt. */
  const [approvedPrompt, setApprovedPrompt] = useState<string | null>(null);

  const groupDropdown = useDropdown();
  const projectDropdown = useDropdown();

  const lineStatusMutation = useUpdateQuoteLineItemStatuses(rfqId);

  const approveMutation = useMutation({
    mutationFn: (quoteId: string) => approveQuote(rfqId, quoteId),
    onSuccess: (_r, quoteId) => {
      void queryClient.invalidateQueries({ queryKey: ['rfqs', rfqId] });
      setApprovedPrompt(quoteId);
    },
  });

  const declineMutation = useMutation({
    mutationFn: (quoteId: string) => declineQuote(rfqId, quoteId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['rfqs', rfqId] }),
  });

  // ── Derived data ─────────────────────────────────────────────────────────────

  /** Grouping is opt-in on the All tab and always on for Approved/Declined. */
  const grouped = statusFilter === 'all' ? groupByProject : true;

  const visibleVendors = useMemo(() => {
    if (!data) return [];
    let vendors = data.vendors.filter((v) => {
      const s = v.status.toUpperCase();
      if (statusFilter === 'approved') return s === 'APPROVED';
      if (statusFilter === 'declined') return s === 'DECLINED';
      return true;
    });
    vendors = vendors.filter((v) => !hiddenVendors.has(v.quoteResponseId));
    if (sortOrder === 'priceAsc' || sortOrder === 'priceDesc') {
      vendors = [...vendors].sort((a, b) =>
        sortOrder === 'priceAsc'
          ? a.totalWithTaxes - b.totalWithTaxes
          : b.totalWithTaxes - a.totalWithTaxes,
      );
    } else if (sortOrder === 'deliveryEarliest' || sortOrder === 'deliveryLatest') {
      const time = (v: QuoteComparisonVendor) =>
        v.leadTimeDate ? new Date(v.leadTimeDate).getTime() : Number.MAX_SAFE_INTEGER;
      vendors = [...vendors].sort((a, b) =>
        sortOrder === 'deliveryEarliest' ? time(a) - time(b) : time(b) - time(a),
      );
    }
    if (pinnedVendor) {
      const pinned = vendors.find((v) => v.quoteResponseId === pinnedVendor);
      if (pinned) {
        vendors = [pinned, ...vendors.filter((v) => v.quoteResponseId !== pinnedVendor)];
      }
    }
    return vendors;
  }, [data, statusFilter, hiddenVendors, sortOrder, pinnedVendor]);

  const hiddenCount = useMemo(() => {
    if (!data) return 0;
    return data.vendors.filter((v) => hiddenVendors.has(v.quoteResponseId)).length;
  }, [data, hiddenVendors]);

  const projects = useMemo(() => {
    if (!data) return [];
    const seen = new Map<string, string>();
    for (const row of data.rows) {
      if (!seen.has(row.projectId)) seen.set(row.projectId, row.projectName);
    }
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [data]);

  const visibleRows = useMemo(() => {
    if (!data) return [];
    if (projectFilter === 'all') return data.rows;
    return data.rows.filter((r) => r.projectId === projectFilter);
  }, [data, projectFilter]);

  /** Rows in render order, with group headers when grouping is on. */
  const rowGroups = useMemo(() => {
    if (!grouped)
      return [{ projectId: null as string | null, projectName: null, rows: visibleRows }];
    const groups = new Map<
      string,
      { projectId: string; projectName: string; rows: QuoteComparisonRow[] }
    >();
    for (const row of visibleRows) {
      const g = groups.get(row.projectId) ?? {
        projectId: row.projectId,
        projectName: row.projectName,
        rows: [],
      };
      g.rows.push(row);
      groups.set(row.projectId, g);
    }
    return Array.from(groups.values());
  }, [grouped, visibleRows]);

  // Per-vendor sub-columns in display order. The Order column only exists on the
  // Approved tab (US 5.19), where the buyer types the quantity to order.
  const subColumns = useMemo(() => {
    const cols: string[] = [];
    if (columnVisibility.priceUnit) cols.push('priceUnit');
    if (columnVisibility.quantityAvailable) cols.push('quantityAvailable');
    if (statusFilter === 'approved') cols.push('order');
    if (columnVisibility.lineDiscount) cols.push('lineDiscount');
    if (columnVisibility.lineTotal) cols.push('lineTotal');
    if (columnVisibility.deliveryDate) cols.push('deliveryDate');
    cols.push('actions');
    return cols;
  }, [columnVisibility, statusFilter]);

  // ── Selection / order helpers ────────────────────────────────────────────────

  const toggleSelect = (cell: QuoteComparisonCell, row: QuoteComparisonRow) => {
    if (!cell.quoteLineItemId) return;
    setSelection((prev) => {
      const next = new Map(prev);
      if (next.has(cell.quoteLineItemId!)) {
        next.delete(cell.quoteLineItemId!);
      } else {
        next.set(cell.quoteLineItemId!, {
          quoteLineItemId: cell.quoteLineItemId!,
          quoteResponseId: cell.quoteResponseId,
          vendorId: cell.vendorId,
          projectId: row.projectId,
        });
      }
      return next;
    });
  };

  const selectAllForVendor = (quoteResponseId: string) => {
    setSelection((prev) => {
      const next = new Map(prev);
      for (const row of visibleRows) {
        const cell = row.cells.find((c) => c.quoteResponseId === quoteResponseId);
        if (!cell?.quoteLineItemId || !cell.hasQuote) continue;
        if (statusFilter === 'declined' && cell.status !== 'DECLINED') continue;
        if (statusFilter === 'approved' && cell.status !== 'APPROVED') continue;
        next.set(cell.quoteLineItemId, {
          quoteLineItemId: cell.quoteLineItemId,
          quoteResponseId,
          vendorId: cell.vendorId,
          projectId: row.projectId,
        });
      }
      return next;
    });
  };

  const setLineStatus = (
    cell: QuoteComparisonCell,
    status: 'APPROVED' | 'DECLINED' | 'PENDING',
  ) => {
    if (!cell.quoteLineItemId) return;
    lineStatusMutation.mutate(
      { quoteId: cell.quoteResponseId, lineItemIds: [cell.quoteLineItemId], status },
      { onError: () => toast.error(t('reviewTable.lineStatusUpdateError')) },
    );
  };

  const restoreAll = () => {
    // Restore every declined line, per visible declined vendor column.
    for (const vendor of visibleVendors) {
      const ids = visibleRows
        .map((row) => row.cells.find((c) => c.quoteResponseId === vendor.quoteResponseId))
        .filter((c): c is QuoteComparisonCell => !!c?.quoteLineItemId && c.status === 'DECLINED')
        .map((c) => c.quoteLineItemId!);
      if (ids.length > 0) {
        lineStatusMutation.mutate(
          { quoteId: vendor.quoteResponseId, lineItemIds: ids, status: 'PENDING' },
          { onError: () => toast.error(t('reviewTable.lineStatusUpdateError')) },
        );
      }
    }
    setSelection(new Map());
  };

  const orderQtyOf = (cell: QuoteComparisonCell): { value: string; invalid: boolean } => {
    const raw = cell.quoteLineItemId ? (orderQuantities.get(cell.quoteLineItemId) ?? '') : '';
    const num = Number(raw);
    const invalid =
      raw !== '' && (!Number.isFinite(num) || num < 0 || num > (cell.quotedQuantity ?? 0));
    return { value: raw, invalid };
  };

  // ── Draft creation (US 5.19) ─────────────────────────────────────────────────

  const buildOrderLines = (vendorQuoteId: string, projectId: string) => {
    const lines: {
      row: QuoteComparisonRow;
      cell: QuoteComparisonCell;
      qty: number;
    }[] = [];
    for (const sel of selection.values()) {
      if (sel.quoteResponseId !== vendorQuoteId || sel.projectId !== projectId) continue;
      for (const row of visibleRows) {
        const cell = row.cells.find((c) => c.quoteLineItemId === sel.quoteLineItemId);
        if (!cell) continue;
        const { value, invalid } = orderQtyOf(cell);
        const qty = invalid || value === '' ? (cell.quotedQuantity ?? 0) : Number(value);
        if (qty > 0) lines.push({ row, cell, qty });
      }
    }
    return lines;
  };

  /** Distinct (quote, project) pairs covered by the current selection. */
  const selectionTargets = useMemo(() => {
    const targets = new Map<
      string,
      { quoteResponseId: string; vendorId: string; projectId: string }
    >();
    for (const sel of selection.values()) {
      targets.set(`${sel.quoteResponseId}:${sel.projectId}`, {
        quoteResponseId: sel.quoteResponseId,
        vendorId: sel.vendorId,
        projectId: sel.projectId,
      });
    }
    return Array.from(targets.values());
  }, [selection]);

  const createDraftMutation = useMutation({
    mutationFn: async (kind: StartOrderKind) => {
      if (!data) return;
      for (const target of selectionTargets) {
        const lines = buildOrderLines(target.quoteResponseId, target.projectId);
        if (lines.length === 0) continue;
        if (kind === 'po') {
          await createPurchaseOrder({
            projectId: target.projectId,
            vendorId: target.vendorId,
            poType: 'STANDARD',
            sourceOfCreation: 'RFQ',
            currency: data.currency,
            pickUp: false,
            rfqId,
            lineItems: lines.map(({ row, cell, qty }) => ({
              description: cell.substituteItemName ?? row.materialName ?? undefined,
              quantityOrdered: qty,
              unitOfMeasure: row.unit,
              unitPrice: cell.unitPrice ?? 0,
              expectedDeliveryDate: cell.deliveryDate ?? undefined,
            })),
          });
        } else {
          await createBulkOrder({
            projectId: target.projectId,
            vendorId: target.vendorId,
            rfqId,
            lineItems: lines.map(({ row, cell, qty }) => ({
              itemReference: cell.substituteItemName ?? row.materialName ?? '-',
              description: cell.substituteItemName ?? row.materialName ?? '-',
              qty,
              unit: row.unit,
              pricePerUnit: cell.unitPrice ?? 0,
            })),
          });
        }
      }
    },
    onSuccess: (_r, kind) => {
      toast.success(t(kind === 'po' ? 'startOrder.poDraftCreated' : 'startOrder.bulkDraftCreated'));
      setStartOrder(null);
      setSelection(new Map());
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['bulk-orders'] });
    },
    onError: () => toast.error(t('startOrder.createError')),
  });

  const startOrderNow = (kind: StartOrderKind) => {
    if (kind === 'po') {
      const target = selectionTargets[0];
      navigate(PO_CREATE_ROUTE, {
        state: {
          mode: 'from-rfq',
          defaultValues: target
            ? { projectId: target.projectId, vendorId: target.vendorId }
            : undefined,
        },
      });
    } else {
      createDraftMutation.mutate('bulk');
    }
  };

  // The post-approve prompt creates a draft PO for the whole approved quote.
  const approvedQuote = approvedPrompt
    ? (data?.vendors.find((v) => v.quoteResponseId === approvedPrompt) ?? null)
    : null;

  const approvedDraftMutation = useCreateDraftPoFromQuote(rfqId);

  const createApprovedDraft = (quoteResponseId: string) => {
    approvedDraftMutation.mutate(quoteResponseId, {
      onSuccess: () => {
        toast.success(t('startOrder.poDraftCreated'));
        setApprovedPrompt(null);
      },
      onError: () => toast.error(t('startOrder.createError')),
    });
  };

  // ── Early states ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return <p className="py-8 text-sm text-muted-foreground">{t('reviewTable.loadError')}</p>;
  }

  if (!data || data.rows.length === 0 || data.vendors.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">{t('reviewTable.noQuotes')}</p>;
  }

  // ── Toolbar pieces ───────────────────────────────────────────────────────────

  const filterChips = (
    <div className="flex gap-2">
      {(['all', 'approved', 'declined'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => {
            onStatusFilterChange(tab);
            setSelection(new Map());
          }}
          className={cn(
            'rounded-full px-3 py-1 text-sm font-medium transition-colors',
            statusFilter === tab
              ? 'bg-filter-chip text-filter-chip-foreground'
              : 'border border-border text-muted-foreground hover:text-foreground',
          )}
        >
          {t(`responsesTab.${tab}`)} ({statusCounts[tab]})
        </button>
      ))}
    </div>
  );

  const groupButton = statusFilter === 'all' && (
    <div ref={groupDropdown.ref} className="relative">
      <button
        type="button"
        onClick={() => {
          if (groupByProject) setGroupByProject(false);
          else groupDropdown.setIsOpen((p) => !p);
        }}
        className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-foreground border border-border rounded-xl hover:bg-accent transition-colors"
      >
        {groupByProject ? (
          <>
            {t('reviewTable.groupByProjects')}
            <CrossIcon className="w-3 h-3" />
          </>
        ) : (
          <>
            {t('reviewTable.group')}
            <ChevronDownIcon className="w-4 h-4" />
          </>
        )}
      </button>
      {groupDropdown.isOpen && !groupByProject && (
        <div className="absolute right-0 mt-1 w-44 bg-card border border-border rounded-xl shadow-lg z-50 p-2">
          <button
            type="button"
            className="w-full text-left px-4 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"
            onClick={() => {
              setGroupByProject(true);
              groupDropdown.setIsOpen(false);
            }}
          >
            {t('reviewTable.groupByProjects')}
          </button>
        </div>
      )}
    </div>
  );

  const projectFilterButton = isPanel && projects.length > 1 && (
    <div ref={projectDropdown.ref} className="relative">
      <button
        type="button"
        onClick={() => projectDropdown.setIsOpen((p) => !p)}
        className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-foreground border border-border rounded-xl hover:bg-accent transition-colors max-w-[160px]"
      >
        <span className="truncate">
          {projectFilter === 'all'
            ? t('reviewTable.allProjects')
            : (projects.find((p) => p.id === projectFilter)?.name ?? '')}
        </span>
        <ChevronDownIcon className="w-4 h-4 shrink-0" />
      </button>
      {projectDropdown.isOpen && (
        <div className="absolute left-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-lg z-50 p-2">
          {[{ id: 'all', name: t('reviewTable.allProjects') }, ...projects].map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn(
                'w-full text-left px-4 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors truncate',
                projectFilter === p.id ? 'font-medium text-foreground' : 'text-card-foreground',
              )}
              onClick={() => {
                setProjectFilter(p.id);
                projectDropdown.setIsOpen(false);
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const collapseAllButton = grouped && (
    <button
      type="button"
      title={
        collapsedGroups.size > 0 ? t('reviewTable.expandGroups') : t('reviewTable.collapseGroups')
      }
      onClick={() =>
        setCollapsedGroups((prev) =>
          prev.size > 0 ? new Set() : new Set(rowGroups.map((g) => g.projectId ?? '')),
        )
      }
      className="flex items-center justify-center w-9 h-9 border border-border rounded-xl text-foreground hover:bg-accent transition-colors"
    >
      <CollapseAllIcon className="w-4 h-4" />
    </button>
  );

  const gearButton = (
    <button
      type="button"
      title={t('tableManagement.title')}
      onClick={() => setShowTableManagement(true)}
      className="flex items-center justify-center w-9 h-9 border border-border rounded-xl text-foreground hover:bg-accent transition-colors"
    >
      <SettingsIcon className="w-4 h-4" />
    </button>
  );

  const sortingButton = <SortingDropdown value={sortOrder} onChange={onSortOrderChange} />;

  // ── Banners ──────────────────────────────────────────────────────────────────

  const hiddenBanner = hiddenCount > 0 && (
    <div className="flex items-center justify-between rounded-lg border border-border bg-[#FBFBFB] px-4 py-2">
      <span className="text-sm text-foreground">
        {t('reviewTable.vendorHidden', { count: hiddenCount })}
      </span>
      <button
        type="button"
        onClick={() => setHiddenVendors(new Set())}
        className="flex items-center gap-1.5 h-8 px-3 text-sm font-medium border border-foreground rounded-xl text-foreground hover:bg-accent transition-colors"
      >
        <EyeOpenedIcon className="w-4 h-4" />
        {t('reviewTable.showAll')}
      </button>
    </div>
  );

  const selectionBanner = selection.size > 0 && (
    <div className="flex items-center justify-between rounded-lg border border-border bg-[#FBFBFB] px-4 py-2">
      <button
        type="button"
        onClick={() => setSelection(new Map())}
        className="flex items-center gap-1.5 text-sm text-foreground hover:text-muted-foreground transition-colors"
        title={t('reviewTable.clearSelection')}
      >
        <CrossInCircleIcon className="w-4 h-4" />
        {t('reviewTable.itemsSelected', { count: selection.size })}
      </button>
      <div className="flex items-center gap-2">
        {statusFilter === 'declined' && (
          <button
            type="button"
            onClick={restoreAll}
            className="flex items-center gap-1.5 h-8 px-3 text-sm font-medium border border-foreground rounded-xl text-foreground hover:bg-accent transition-colors"
          >
            <RestoreIcon className="w-4 h-4" />
            {t('reviewTable.restoreAll')}
          </button>
        )}
        {statusFilter === 'approved' && (
          <>
            <Button
              size="sm"
              leftIcon={<PlusInCircleIcon className="w-4 h-4" />}
              onClick={() => setStartOrder('po')}
            >
              {t('reviewTable.createPo')}
            </Button>
            <Button
              size="sm"
              leftIcon={<PlusInCircleIcon className="w-4 h-4" />}
              onClick={() => setStartOrder('bulk')}
            >
              {t('reviewTable.createBulk')}
            </Button>
          </>
        )}
      </div>
    </div>
  );

  // ── Cell renderers ───────────────────────────────────────────────────────────

  const subColumnWidth: Record<string, string> = {
    priceUnit: 'min-w-[104px]',
    quantityAvailable: 'min-w-[180px]',
    order: 'min-w-[96px]',
    lineDiscount: 'min-w-[88px]',
    lineTotal: 'min-w-[164px]',
    deliveryDate: 'min-w-[120px]',
    actions: 'min-w-[92px]',
  };

  function renderActions(cell: QuoteComparisonCell, row: QuoteComparisonRow) {
    const selected = !!cell.quoteLineItemId && selection.has(cell.quoteLineItemId);
    const noteButton = (
      <span className="relative inline-flex">
        <button
          type="button"
          title={t('reviewTable.viewNote')}
          onClick={() =>
            setOpenNoteCell(openNoteCell === cell.quoteLineItemId ? null : cell.quoteLineItemId)
          }
          className="relative text-foreground/70 hover:text-foreground transition-colors"
        >
          <EditIcon className="w-4 h-4" />
          {cell.notes && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-destructive" />
          )}
        </button>
        {openNoteCell !== null && openNoteCell === cell.quoteLineItemId && (
          <div className="absolute right-0 top-6 z-50 w-56 rounded-xl border border-border bg-card p-3 text-left text-xs text-card-foreground shadow-lg whitespace-pre-line">
            {cell.notes ?? t('reviewTable.noNote')}
          </div>
        )}
      </span>
    );

    if (selected) {
      return (
        <div className="flex items-center gap-2.5">
          {noteButton}
          <button
            type="button"
            title={t('reviewTable.deselectLine')}
            onClick={() => toggleSelect(cell, row)}
            className="text-foreground/70 hover:text-foreground transition-colors"
          >
            <CrossInCircleIcon className="w-4 h-4" />
          </button>
        </div>
      );
    }

    if (statusFilter === 'declined') {
      return (
        <div className="flex items-center gap-2.5">
          {noteButton}
          <button
            type="button"
            title={t('reviewTable.restoreLine')}
            onClick={() => setLineStatus(cell, 'PENDING')}
            className="text-foreground/70 hover:text-foreground transition-colors"
          >
            <RestoreIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            title={t('reviewTable.selectLine')}
            onClick={() => toggleSelect(cell, row)}
            className="text-foreground/70 hover:text-foreground transition-colors"
          >
            <PlusInCircleIcon className="w-4 h-4" />
          </button>
        </div>
      );
    }

    if (statusFilter === 'approved') {
      return (
        <div className="flex items-center gap-2.5">
          {noteButton}
          <button
            type="button"
            title={t('reviewTable.declineLine')}
            onClick={() => setLineStatus(cell, 'DECLINED')}
            className="text-foreground/70 hover:text-foreground transition-colors"
          >
            <DeleteIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            title={t('reviewTable.selectLine')}
            onClick={() => toggleSelect(cell, row)}
            className="text-foreground/70 hover:text-foreground transition-colors"
          >
            <PlusInCircleIcon className="w-4 h-4" />
          </button>
        </div>
      );
    }

    // All tab: pending lines get approve/decline, reviewed lines get restore.
    if (cell.status === 'APPROVED' || cell.status === 'DECLINED') {
      return (
        <div className="flex items-center gap-2.5">
          {noteButton}
          <button
            type="button"
            title={t('reviewTable.restoreLine')}
            onClick={() => setLineStatus(cell, 'PENDING')}
            className="text-foreground/70 hover:text-foreground transition-colors"
          >
            <RestoreIcon className="w-4 h-4" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2.5">
        {noteButton}
        <button
          type="button"
          title={t('reviewTable.approveLine')}
          onClick={() => setLineStatus(cell, 'APPROVED')}
          className="text-foreground/70 hover:text-foreground transition-colors"
        >
          <CheckCircleIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          title={t('reviewTable.declineLine')}
          onClick={() => setLineStatus(cell, 'DECLINED')}
          className="text-foreground/70 hover:text-foreground transition-colors"
        >
          <CrossInCircleIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  function renderVendorCells(row: QuoteComparisonRow, vendor: QuoteComparisonVendor) {
    const cell = row.cells.find((c) => c.quoteResponseId === vendor.quoteResponseId);

    if (!cell || !cell.hasQuote) {
      return (
        <td
          key={`${row.rfqLineItemId}-${vendor.quoteResponseId}`}
          colSpan={subColumns.length}
          className={cn(
            'border-b border-l border-foreground/10 px-3 py-3 text-center text-sm text-foreground/70',
            NOT_QUOTED_BG,
          )}
        >
          {t('reviewTable.notQuoted')}
        </td>
      );
    }

    // Hide cells whose line status doesn't match the Approved/Declined tab.
    if (
      (statusFilter === 'approved' && cell.status !== 'APPROVED') ||
      (statusFilter === 'declined' && cell.status !== 'DECLINED')
    ) {
      return (
        <td
          key={`${row.rfqLineItemId}-${vendor.quoteResponseId}`}
          colSpan={subColumns.length}
          className="border-b border-l border-foreground/10 px-3 py-3"
        />
      );
    }

    const selected = !!cell.quoteLineItemId && selection.has(cell.quoteLineItemId);
    const rowBg = selected
      ? ROW_SELECTED_BG
      : cell.substituteItemId
        ? ROW_SUBSTITUTE_BG
        : cell.isLowest
          ? ROW_BEST_PRICE_BG
          : undefined;

    const { value: orderValue, invalid: orderInvalid } = orderQtyOf(cell);

    return subColumns.map((col, idx) => {
      const base = cn(
        'border-b border-foreground/10 px-3 py-3 text-sm text-foreground whitespace-nowrap',
        idx === 0 && 'border-l',
        subColumnWidth[col],
        rowBg,
      );
      switch (col) {
        case 'priceUnit':
          return (
            <td key={col} className={base}>
              <span className="inline-flex items-center gap-1.5">
                {formatCurrency(cell.unitPrice ?? 0, data!.currency)}
                {cell.isLowest && !cell.substituteItemId && (
                  <TagIcon className="w-[18px] h-[18px] text-[#00A63E]" />
                )}
              </span>
            </td>
          );
        case 'quantityAvailable':
          return (
            <td key={col} className={base}>
              {cell.quotedQuantity}/{row.quantity} {row.unit}
            </td>
          );
        case 'order':
          return (
            <td key={col} className={base}>
              <span className="inline-flex items-center gap-1">
                {orderInvalid && (
                  <WarningCircleIcon className="w-[18px] h-[18px] text-destructive" />
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  value={orderValue}
                  placeholder="0"
                  title={orderInvalid ? t('reviewTable.orderExceedsAvailable') : undefined}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, '');
                    setOrderQuantities((prev) => {
                      const next = new Map(prev);
                      if (cell.quoteLineItemId) next.set(cell.quoteLineItemId, v);
                      return next;
                    });
                  }}
                  className={cn(
                    'w-14 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60',
                    orderInvalid ? 'text-destructive' : 'text-foreground',
                  )}
                />
              </span>
            </td>
          );
        case 'lineDiscount':
          return (
            <td key={col} className={base}>
              {discountText(cell, data!.currency)}
            </td>
          );
        case 'lineTotal':
          return (
            <td key={col} className={base}>
              {cell.lineTotal !== null ? formatCurrency(cell.lineTotal, data!.currency) : '-'}
            </td>
          );
        case 'deliveryDate':
          return (
            <td key={col} className={base}>
              {cellDate(cell.deliveryDate)}
            </td>
          );
        case 'actions':
          return (
            <td key={col} className={base}>
              {renderActions(cell, row)}
            </td>
          );
        default:
          return null;
      }
    });
  }

  function renderSubtotalRow(groupRows: QuoteComparisonRow[], key: string) {
    return (
      <tr key={key} className={SUBTOTAL_BG}>
        <td
          className={cn(
            'sticky left-0 z-10 px-3 py-3 text-sm font-semibold text-foreground border-b border-foreground/10',
            SUBTOTAL_BG,
          )}
        >
          {t('reviewTable.subtotal')}
        </td>
        {visibleVendors.map((vendor) => {
          const subtotal = groupRows.reduce((sum, row) => {
            const cell = row.cells.find((c) => c.quoteResponseId === vendor.quoteResponseId);
            return sum + (cell?.lineTotal ?? cell?.extendedCost ?? 0);
          }, 0);
          return (
            <td
              key={vendor.quoteResponseId}
              colSpan={subColumns.length}
              className="border-b border-l border-foreground/10 px-3 py-2"
            >
              <div className="text-sm text-foreground">{t('reviewTable.totalWithTaxes')}</div>
              <div className="text-base font-semibold text-foreground">
                {formatCurrency(subtotal, data!.currency)}
              </div>
            </td>
          );
        })}
      </tr>
    );
  }

  const lowestTotal = Math.min(...visibleVendors.map((v) => v.totalWithTaxes));

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={cn('flex flex-col', isPanel ? 'gap-3' : 'gap-4')}>
      {isPanel ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {projectFilterButton}
              {sortingButton}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {toggleSlot}
              {gearButton}
            </div>
          </div>
          {filterChips}
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          {filterChips}
          <div className="flex items-center gap-2">
            {groupButton}
            {collapseAllButton}
            {sortingButton}
            {gearButton}
          </div>
        </div>
      )}

      {hiddenBanner}
      {selectionBanner}

      {visibleVendors.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">{t('reviewTable.noQuotes')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-foreground/10">
          <table className="border-separate border-spacing-0 text-sm w-max min-w-full">
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  className={cn(
                    'sticky left-0 z-20 min-w-[140px] max-w-[180px] border-b border-foreground/10 px-3 py-2 text-left align-top',
                    TABLE_HEAD_BG,
                  )}
                >
                  <div className="text-xs font-bold text-[#2A2A2A] leading-4">
                    {t('reviewTable.lineItems')}
                    <br />
                    <span className="font-bold">
                      {t('reviewTable.lineItemsCount', { count: visibleRows.length })}
                    </span>
                  </div>
                </th>
                {visibleVendors.map((vendor) => (
                  <th
                    key={vendor.quoteResponseId}
                    colSpan={subColumns.length}
                    className={cn(
                      'border-b border-l border-foreground/10 px-3 py-1.5 text-left',
                      TABLE_HEAD_BG,
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title={t('reviewTable.hideVendor')}
                        onClick={() =>
                          setHiddenVendors((prev) => new Set(prev).add(vendor.quoteResponseId))
                        }
                        className="text-foreground/70 hover:text-foreground transition-colors shrink-0"
                      >
                        <EyeClosedIcon className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-semibold text-[#1B1D22] truncate">
                        {vendor.vendorName}
                      </span>
                      <span className="flex-1" />
                      {(statusFilter === 'declined' || statusFilter === 'approved') && (
                        <button
                          type="button"
                          onClick={() => selectAllForVendor(vendor.quoteResponseId)}
                          className="flex items-center gap-1 h-7 px-2.5 text-xs font-medium bg-card border border-border rounded-full text-foreground hover:bg-accent transition-colors shrink-0"
                        >
                          <PlusIcon className="w-3.5 h-3.5" />
                          {t('reviewTable.selectAll')}
                        </button>
                      )}
                      <button
                        type="button"
                        title={t('reviewTable.moveToFront')}
                        onClick={() =>
                          setPinnedVendor(
                            pinnedVendor === vendor.quoteResponseId ? null : vendor.quoteResponseId,
                          )
                        }
                        className="text-foreground/70 hover:text-foreground transition-colors shrink-0"
                      >
                        <RepeatIcon className="w-4 h-4" />
                      </button>
                      <MessageBadgeIcon
                        hasNotification={vendor.hasNotes}
                        onClick={() =>
                          navigate(
                            `${RFQ_ROUTES.quoteResponseDetail
                              .replace(':id', rfqId)
                              .replace(':quoteId', vendor.quoteResponseId)}?tab=messages`,
                          )
                        }
                      />
                      <button
                        type="button"
                        title={t('responsesTab.attachments')}
                        onClick={() =>
                          navigate(
                            `${RFQ_ROUTES.quoteResponseDetail
                              .replace(':id', rfqId)
                              .replace(':quoteId', vendor.quoteResponseId)}?tab=attachments`,
                          )
                        }
                        className="text-foreground/70 hover:text-foreground transition-colors shrink-0"
                      >
                        <PaperclipIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
              <tr>
                {visibleVendors.map((vendor) =>
                  subColumns.map((col, idx) => (
                    <th
                      key={`${vendor.quoteResponseId}-${col}`}
                      className={cn(
                        'border-b border-foreground/10 px-3 py-1.5 text-left text-sm font-medium text-[#1B1D22] whitespace-nowrap',
                        idx === 0 && 'border-l',
                        subColumnWidth[col],
                        TABLE_HEAD_BG,
                      )}
                    >
                      {col === 'actions'
                        ? t('reviewTable.actions')
                        : col === 'order'
                          ? t('reviewTable.order')
                          : col === 'priceUnit'
                            ? t('reviewTable.priceUnit')
                            : col === 'quantityAvailable'
                              ? t('reviewTable.availableRequested')
                              : col === 'lineDiscount'
                                ? t('reviewTable.discount')
                                : col === 'lineTotal'
                                  ? t('reviewTable.lineTotalWithTax')
                                  : t('reviewTable.deliveryDate')}
                    </th>
                  )),
                )}
              </tr>
            </thead>

            <tbody>
              {rowGroups.map((group) => {
                const groupKey = group.projectId ?? 'all';
                const collapsed = collapsedGroups.has(groupKey);
                return [
                  group.projectId !== null && (
                    <tr key={`group-${groupKey}`}>
                      <td
                        colSpan={1 + visibleVendors.length * subColumns.length}
                        className={cn(
                          'border-b border-foreground/10 px-3 py-2 cursor-pointer select-none',
                          GROUP_HEADER_BG,
                        )}
                        onClick={() =>
                          setCollapsedGroups((prev) => {
                            const next = new Set(prev);
                            if (next.has(groupKey)) next.delete(groupKey);
                            else next.add(groupKey);
                            return next;
                          })
                        }
                      >
                        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                          {collapsed ? (
                            <ChevronRightIcon className="w-4 h-4" />
                          ) : (
                            <ChevronDownIcon className="w-4 h-4" />
                          )}
                          {group.projectName}
                        </span>
                      </td>
                    </tr>
                  ),
                  !collapsed &&
                    group.rows.map((row) => (
                      <tr key={row.rfqLineItemId}>
                        <td className="sticky left-0 z-10 bg-card border-b border-foreground/10 px-3 py-3 text-sm text-foreground min-w-[140px] max-w-[180px]">
                          <span className="block truncate" title={row.materialName ?? undefined}>
                            {row.materialName ?? '-'}
                          </span>
                        </td>
                        {visibleVendors.map((vendor) => renderVendorCells(row, vendor))}
                      </tr>
                    )),
                  group.projectId !== null &&
                    !collapsed &&
                    renderSubtotalRow(group.rows, `subtotal-${groupKey}`),
                ];
              })}
            </tbody>

            <tfoot>
              <tr>
                <td
                  className={cn(
                    'sticky left-0 z-10 px-3 py-3 text-left align-top font-bold text-[#2A2A2A]',
                    TABLE_HEAD_BG,
                  )}
                >
                  {t('reviewTable.total')}
                </td>
                {visibleVendors.map((vendor) => {
                  const isLowestTotal = vendor.totalWithTaxes === lowestTotal;
                  const pending = quoteIsPending(vendor.status);
                  return (
                    <td
                      key={vendor.quoteResponseId}
                      colSpan={subColumns.length}
                      className={cn(
                        'border-l border-foreground/10 px-3 py-3 align-top',
                        isLowestTotal ? 'bg-[#D7EFDF]' : TABLE_HEAD_BG,
                      )}
                    >
                      <div className="flex gap-6">
                        <div className="flex flex-col gap-3 min-w-[180px]">
                          <div>
                            <div className="text-sm text-foreground">
                              {t('reviewTable.totalWithTaxes')}
                            </div>
                            <div className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                              {formatCurrency(vendor.totalWithTaxes, data.currency)}
                              {isLowestTotal && (
                                <TagIcon className="w-[18px] h-[18px] text-[#00A63E]" />
                              )}
                            </div>
                          </div>
                          {pending ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={declineMutation.isPending}
                                onClick={() => declineMutation.mutate(vendor.quoteResponseId)}
                                className="flex items-center gap-1.5 h-8 px-3 bg-card border border-black rounded-xl text-sm font-medium text-black hover:bg-black/5 transition-colors disabled:opacity-50"
                              >
                                <CrossInCircleIcon className="w-4 h-4" />
                                {t('responsesTab.decline')}
                              </button>
                              <button
                                type="button"
                                disabled={approveMutation.isPending}
                                onClick={() => approveMutation.mutate(vendor.quoteResponseId)}
                                className="flex items-center gap-1.5 h-8 px-3 bg-card border border-black rounded-xl text-sm font-medium text-black hover:bg-black/5 transition-colors disabled:opacity-50"
                              >
                                <CheckCircleIcon className="w-4 h-4" />
                                {t('responsesTab.approve')}
                              </button>
                            </div>
                          ) : (
                            <Badge className="self-start bg-[#E8EAED] text-[#2D3139] border-0 rounded-full text-xs px-2 py-0.5">
                              {vendor.status.toUpperCase() === 'APPROVED'
                                ? t('reviewTable.approvedBadge')
                                : t('reviewTable.declinedBadge')}
                            </Badge>
                          )}
                        </div>
                        <div className="w-px bg-foreground/10 self-stretch" />
                        <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
                          <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-foreground">{t('reviewTable.delivery')}</span>
                            <span className="font-medium text-foreground">
                              {footerDate(vendor.leadTimeDate)}
                            </span>
                          </div>
                          {vendor.shipmentAndHandling !== null && (
                            <div className="flex items-center justify-between gap-4 text-sm">
                              <span className="text-foreground">
                                {t('reviewTable.shipmentHandling')}
                              </span>
                              <span className="font-medium text-foreground">
                                {formatCurrency(vendor.shipmentAndHandling, data.currency)}
                              </span>
                            </div>
                          )}
                          {columnVisibility.totalDiscount && vendor.discountPercent !== null && (
                            <div className="flex items-center justify-between gap-4 text-sm">
                              <span className="text-foreground">{t('reviewTable.discount')}</span>
                              <span className="font-medium text-foreground">
                                {vendor.discountPercent}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {showTableManagement && (
        <TableManagementModal
          visibility={columnVisibility}
          onChange={setColumnVisibility}
          onClose={() => setShowTableManagement(false)}
        />
      )}

      {startOrder && (
        <StartOrderModal
          kind={startOrder}
          isCreating={createDraftMutation.isPending}
          onStartNow={() => startOrderNow(startOrder)}
          onCreateDraft={() => createDraftMutation.mutate(startOrder)}
          onClose={() => setStartOrder(null)}
        />
      )}

      {approvedQuote && (
        <StartOrderModal
          kind="po"
          isCreating={approvedDraftMutation.isPending}
          onStartNow={() => {
            navigate(PO_CREATE_ROUTE, {
              state: {
                mode: 'from-rfq',
                defaultValues: { vendorId: approvedQuote.vendorId },
              },
            });
          }}
          onCreateDraft={() => createApprovedDraft(approvedQuote.quoteResponseId)}
          onClose={() => setApprovedPrompt(null)}
        />
      )}
    </div>
  );
}
