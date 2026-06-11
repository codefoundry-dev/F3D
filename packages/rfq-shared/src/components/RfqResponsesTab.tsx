import { approveQuote, declineQuote } from '@forethread/api-client';
import type { RfqDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Badge,
  MessageBadgeIcon,
  cn,
  formatCurrency,
  formatStatus,
  toast,
} from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CoinsIcon from '@forethread/ui-components/assets/icons/coins.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import DateIcon from '@forethread/ui-components/assets/icons/date.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';
import TaxIcon from '@forethread/ui-components/assets/icons/tax.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PO_CREATE_ROUTE, RFQ_ROUTES } from '../constants/routes';
import { useCreateDraftPoFromQuote } from '../hooks/useRfqs';

import { QuoteComparisonTable, type QuoteStatusFilter } from './QuoteComparisonTable';
import { SortingDropdown, type QuoteSortOrder } from './SortingDropdown';
import { StartOrderModal } from './StartOrderModal';

type QuoteResponse = RfqDetail['quoteResponses'][number];

type ViewMode = 'list' | 'table';

interface RfqResponsesTabProps {
  rfqId: string;
  quoteResponses: QuoteResponse[];
  layout?: 'page' | 'panel';
  /** Controlled view mode (page layout — toggle lives in RfqDetailTabs rightSlot) */
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  /**
   * Open a quote drill-in. The side panel passes this to show the quote details
   * inside the panel (US 5.06); when omitted, clicks navigate to the quote page.
   */
  onOpenQuote?: (quoteId: string, tab: 'messages' | 'lineItems' | 'attachments') => void;
}

/* ── Exported view-mode toggle (for page layout rightSlot) ─────────────── */

interface ResponsesViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const LIST_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path
      d="M2 4h12M2 8h12M2 12h12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const TABLE_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export function ResponsesViewToggle({ viewMode, onViewModeChange }: ResponsesViewToggleProps) {
  const { t } = useTranslation('rfqs');
  return (
    <div className="flex rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => onViewModeChange('list')}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
          viewMode === 'list'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {LIST_ICON}
        {t('responsesTab.list')}
      </button>
      <button
        type="button"
        onClick={() => onViewModeChange('table')}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
          viewMode === 'table'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {TABLE_ICON}
        {t('responsesTab.table')}
      </button>
    </div>
  );
}

/** "Jan 25 - Jan 25, 2026" — the committed delivery window on a response card. */
function formatDeliveryRange(start: string | null, end: string | null): string {
  if (!start && !end) return '-';
  const fmt = (iso: string, withYear: boolean) =>
    new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(withYear ? { year: 'numeric' } : {}),
    });
  if (start && end) {
    const sameYear = new Date(start).getFullYear() === new Date(end).getFullYear();
    return `${fmt(start, !sameYear)} - ${fmt(end, true)}`;
  }
  return fmt((start ?? end)!, true);
}

export function RfqResponsesTab({
  rfqId,
  quoteResponses,
  layout = 'page',
  viewMode: controlledViewMode,
  onViewModeChange,
  onOpenQuote,
}: RfqResponsesTabProps) {
  const isPanel = layout === 'panel';
  const { t } = useTranslation('rfqs');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<QuoteStatusFilter>('all');
  const [sortOrder, setSortOrder] = useState<QuoteSortOrder>('relevance');
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>('list');
  /** Quote just approved from a card — drives the post-approve PO prompt (US 5.19). */
  const [approvedPrompt, setApprovedPrompt] = useState<QuoteResponse | null>(null);
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;

  const approveMutation = useMutation({
    mutationFn: (quoteId: string) => approveQuote(rfqId, quoteId),
    onSuccess: (_r, quoteId) => {
      void queryClient.invalidateQueries({ queryKey: ['rfqs', rfqId] });
      setApprovedPrompt(quoteResponses.find((qr) => qr.id === quoteId) ?? null);
    },
  });

  const declineMutation = useMutation({
    mutationFn: (quoteId: string) => declineQuote(rfqId, quoteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rfqs', rfqId] });
    },
  });

  const draftPoMutation = useCreateDraftPoFromQuote(rfqId);

  const counts: Record<QuoteStatusFilter, number> = {
    all: quoteResponses.length,
    approved: quoteResponses.filter((qr) => qr.status.toLowerCase() === 'approved').length,
    declined: quoteResponses.filter((qr) => qr.status.toLowerCase() === 'declined').length,
  };

  const filteredResponses = useMemo(() => {
    let responses = quoteResponses.filter((qr) => {
      if (activeFilter === 'all') return true;
      return qr.status.toLowerCase() === activeFilter;
    });
    if (sortOrder === 'priceAsc' || sortOrder === 'priceDesc') {
      responses = [...responses].sort((a, b) =>
        sortOrder === 'priceAsc' ? a.totalCost - b.totalCost : b.totalCost - a.totalCost,
      );
    } else if (sortOrder === 'deliveryEarliest' || sortOrder === 'deliveryLatest') {
      const time = (qr: QuoteResponse) =>
        qr.earliestDeliveryDate
          ? new Date(qr.earliestDeliveryDate).getTime()
          : Number.MAX_SAFE_INTEGER;
      responses = [...responses].sort((a, b) =>
        sortOrder === 'deliveryEarliest' ? time(a) - time(b) : time(b) - time(a),
      );
    }
    return responses;
  }, [quoteResponses, activeFilter, sortOrder]);

  const viewToggle = (
    <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
      <button
        type="button"
        onClick={() => setViewMode('list')}
        className={`flex items-center justify-center w-9 h-9 transition-colors ${
          viewMode === 'list'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {LIST_ICON}
      </button>
      <button
        type="button"
        onClick={() => setViewMode('table')}
        className={`flex items-center justify-center w-9 h-9 transition-colors ${
          viewMode === 'table'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {TABLE_ICON}
      </button>
    </div>
  );

  // ── Table view: the side-by-side comparison (US 5.06) ───────────────────────

  if (viewMode === 'table') {
    return (
      <QuoteComparisonTable
        rfqId={rfqId}
        layout={layout}
        statusFilter={activeFilter}
        onStatusFilterChange={setActiveFilter}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        statusCounts={counts}
        toggleSlot={isPanel ? viewToggle : undefined}
      />
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────

  const sortingBtn = <SortingDropdown value={sortOrder} onChange={setSortOrder} />;

  const filterTabs = (
    <div className="flex gap-2">
      {(['all', 'approved', 'declined'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => setActiveFilter(tab)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            activeFilter === tab
              ? 'bg-filter-chip text-filter-chip-foreground'
              : 'border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          {t(`responsesTab.${tab}`)} ({counts[tab]})
        </button>
      ))}
    </div>
  );

  return (
    <div className={isPanel ? 'space-y-3' : 'space-y-4'}>
      {isPanel ? (
        <>
          {/* Panel: row 1 — Sorting + icon-only view toggle */}
          <div className="flex items-center justify-between">
            {sortingBtn}
            {viewToggle}
          </div>
          {/* Panel: row 2 — filter tabs */}
          {filterTabs}
        </>
      ) : (
        /* Page: filter tabs left, sorting right */
        <div className="flex items-center justify-between">
          {filterTabs}
          {sortingBtn}
        </div>
      )}

      {/* Response cards */}
      {filteredResponses.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t('responsesTab.noResponses')}
        </p>
      ) : (
        <div className="space-y-3">
          {filteredResponses.map((qr) => {
            const status = qr.status.toUpperCase();
            // SUBMITTED quotes are the ones actually awaiting the buyer's decision.
            const isPending = status === 'PENDING' || status === 'SUBMITTED';
            const isMutating =
              (approveMutation.isPending && approveMutation.variables === qr.id) ||
              (declineMutation.isPending && declineMutation.variables === qr.id);

            return (
              <ResponseCard
                key={qr.id}
                response={qr}
                layout={layout}
                isPending={isPending}
                isMutating={isMutating}
                onApprove={() => approveMutation.mutate(qr.id)}
                onDecline={() => declineMutation.mutate(qr.id)}
                onMessageClick={() =>
                  onOpenQuote
                    ? onOpenQuote(qr.id, 'messages')
                    : navigate(
                        `${RFQ_ROUTES.quoteResponseDetail.replace(':id', rfqId).replace(':quoteId', qr.id)}?tab=messages`,
                      )
                }
                onAttachmentClick={() =>
                  onOpenQuote
                    ? onOpenQuote(qr.id, 'attachments')
                    : navigate(
                        `${RFQ_ROUTES.quoteResponseDetail.replace(':id', rfqId).replace(':quoteId', qr.id)}?tab=attachments`,
                      )
                }
                onCardClick={() =>
                  onOpenQuote
                    ? onOpenQuote(qr.id, 'lineItems')
                    : navigate(
                        `${RFQ_ROUTES.quoteResponseDetail.replace(':id', rfqId).replace(':quoteId', qr.id)}?tab=lineItems`,
                      )
                }
              />
            );
          })}
        </div>
      )}

      {/* Post-approve prompt: offer to start PO creation (US 5.19) */}
      {approvedPrompt && (
        <StartOrderModal
          kind="po"
          isCreating={draftPoMutation.isPending}
          onStartNow={() =>
            navigate(PO_CREATE_ROUTE, {
              state: {
                mode: 'from-rfq',
                defaultValues: { vendorId: approvedPrompt.vendorId },
              },
            })
          }
          onCreateDraft={() =>
            draftPoMutation.mutate(approvedPrompt.id, {
              onSuccess: () => {
                toast.success(t('startOrder.poDraftCreated'));
                setApprovedPrompt(null);
              },
              onError: () => toast.error(t('startOrder.createError')),
            })
          }
          onClose={() => setApprovedPrompt(null)}
        />
      )}
    </div>
  );
}

// ── Response Card ──────────────────────────────────────────────────────────

interface ResponseCardProps {
  response: QuoteResponse;
  layout: 'page' | 'panel';
  isPending: boolean;
  isMutating: boolean;
  onApprove: () => void;
  onDecline: () => void;
  onMessageClick: () => void;
  onAttachmentClick: () => void;
  onCardClick: () => void;
}

function ResponseCard({
  response,
  layout,
  isPending,
  isMutating,
  onApprove,
  onDecline,
  onMessageClick,
  onAttachmentClick,
  onCardClick,
}: ResponseCardProps) {
  const { t } = useTranslation('rfqs');
  const isPanel = layout === 'panel';
  const discountText = response.discountPercent
    ? `${response.discountPercent}%  (${formatCurrency(response.discountAmount ?? 0)})`
    : '-';

  const coverageText = `${response.itemsCovered} / ${response.totalItems} items`;
  const deliveryText = formatDeliveryRange(
    response.earliestDeliveryDate ?? null,
    response.latestDeliveryDate ?? null,
  );

  const headerBadge = (
    <Badge className="bg-[#e4e4e4] text-[#262626] border-0 rounded-full text-xs px-2 py-0.5">
      {formatStatus(response.status)}
    </Badge>
  );

  const indicatorIcons = (
    <div
      className="flex items-center gap-1"
      role="presentation"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <MessageBadgeIcon hasNotification={response.hasNotes ?? false} onClick={onMessageClick} />
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        onClick={onAttachmentClick}
        title={t('responsesTab.attachments')}
      >
        <PaperclipIcon className="w-4 h-4" />
      </button>
    </div>
  );

  const approveDeclineButtons = isPending && (
    <div
      className="flex items-center gap-2"
      role="presentation"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={isMutating}
        onClick={onDecline}
        className="flex items-center gap-1.5 h-8 px-3 py-1.5 border border-black rounded-xl text-sm font-medium text-black hover:bg-black/5 transition-colors disabled:opacity-50"
      >
        <CrossInCircleIcon className="w-4 h-4" />
        {t('responsesTab.decline')}
      </button>
      <button
        type="button"
        disabled={isMutating}
        onClick={onApprove}
        className="flex items-center gap-1.5 h-8 px-3 py-1.5 border border-black rounded-xl text-sm font-medium text-black hover:bg-black/5 transition-colors disabled:opacity-50"
      >
        <CheckCircleIcon className="w-4 h-4" />
        {t('responsesTab.approve')}
      </button>
    </div>
  );

  if (!isPanel) {
    /* Page layout: labelled metadata columns with the actions on the right (US 5.06). */
    return (
      <div
        className="rounded-lg border border-border bg-card p-4 cursor-pointer hover:border-border-hover hover:ring-1 hover:ring-border-hover transition-[box-shadow,border-color]"
        onClick={onCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onCardClick();
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">{response.vendorName}</span>
            {headerBadge}
          </div>
          {indicatorIcons}
        </div>

        <div className="mt-3 flex items-start gap-6">
          <div className="grid flex-1 grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
            <MetaFieldLabelled
              icon={<CoinsIcon className="w-4 h-4" />}
              label={t('responsesTab.totalQuoteCost')}
              value={formatCurrency(response.totalCost)}
            />
            <MetaFieldLabelled
              icon={<TaxIcon className="w-4 h-4" />}
              label={t('responsesTab.overallDiscount')}
              value={discountText}
            />
            <MetaFieldLabelled
              icon={<PackageIcon className="w-4 h-4" />}
              label={t('responsesTab.quoteCoverage')}
              value={coverageText}
            />
            <MetaFieldLabelled
              icon={<DateIcon className="w-4 h-4" />}
              label={t('responsesTab.earliestDelivery')}
              value={deliveryText}
            />
          </div>
          <div className="self-center shrink-0">{approveDeclineButtons}</div>
        </div>
      </div>
    );
  }

  /* Panel layout: compact two-column card. */
  return (
    <div
      className="rounded-lg border border-border p-4 cursor-pointer hover:border-border-hover hover:ring-1 hover:ring-border-hover transition-[box-shadow,border-color]"
      onClick={onCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCardClick();
        }
      }}
    >
      {/* Header row: vendor name + status */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{response.vendorName}</span>
        {headerBadge}
      </div>

      {/* Metadata: 2-column compact grid */}
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5">
        <MetaFieldCompact
          icon={<CoinsIcon className="w-4 h-4" />}
          value={formatCurrency(response.totalCost)}
        />
        <MetaFieldCompact icon={<TaxIcon className="w-4 h-4" />} value={discountText} />
        <MetaFieldCompact icon={<PackageIcon className="w-4 h-4" />} value={coverageText} />
        <MetaFieldCompact icon={<DateIcon className="w-4 h-4" />} value={deliveryText} />
      </div>

      {/* Footer: buttons left + icons right */}
      <div className="mt-3 flex items-center justify-between">
        {approveDeclineButtons || <div />}
        {indicatorIcons}
      </div>
    </div>
  );
}

// ── Meta fields ────────────────────────────────────────────────────────────

function MetaFieldLabelled({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="shrink-0 w-4 h-4 flex items-center justify-center">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <div className={cn('mt-1 text-sm font-medium text-foreground truncate')}>{value}</div>
    </div>
  );
}

function MetaFieldCompact({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="text-sm font-medium text-foreground truncate">{value}</span>
    </div>
  );
}
