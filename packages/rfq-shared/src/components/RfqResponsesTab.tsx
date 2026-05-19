import { approveQuote, declineQuote } from '@forethread/api-client';
import type { RfqDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Badge, MessageBadgeIcon, formatCurrency, formatStatus } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CoinsIcon from '@forethread/ui-components/assets/icons/coins.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import DateIcon from '@forethread/ui-components/assets/icons/date.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { RFQ_ROUTES } from '../constants/routes';

type QuoteResponse = RfqDetail['quoteResponses'][number];

type FilterTab = 'all' | 'approved' | 'declined';
type ViewMode = 'list' | 'table';

interface RfqResponsesTabProps {
  rfqId: string;
  quoteResponses: QuoteResponse[];
  layout?: 'page' | 'panel';
  /** Controlled view mode (page layout — toggle lives in RfqDetailTabs rightSlot) */
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
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

function formatDeliveryDate(submittedAt: string | null): string {
  if (!submittedAt) return '-';
  const d = new Date(submittedAt);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function RfqResponsesTab({
  rfqId,
  quoteResponses,
  layout = 'page',
  viewMode: controlledViewMode,
  onViewModeChange,
}: RfqResponsesTabProps) {
  const isPanel = layout === 'panel';
  const { t } = useTranslation('rfqs');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>('list');
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;

  const approveMutation = useMutation({
    mutationFn: (quoteId: string) => approveQuote(rfqId, quoteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rfqs', rfqId] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (quoteId: string) => declineQuote(rfqId, quoteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rfqs', rfqId] });
    },
  });

  const filteredResponses = quoteResponses.filter((qr) => {
    if (activeFilter === 'all') return true;
    return qr.status.toLowerCase() === activeFilter;
  });

  const counts = {
    all: quoteResponses.length,
    approved: quoteResponses.filter((qr) => qr.status.toLowerCase() === 'approved').length,
    declined: quoteResponses.filter((qr) => qr.status.toLowerCase() === 'declined').length,
  };

  const sortingBtn = (
    <button
      type="button"
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-accent transition-colors"
    >
      {t('responsesTab.sorting')}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="mt-0.5">
        <path
          d="M3 4.5L6 7.5L9 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

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
            <div className="flex rounded-lg border border-border overflow-hidden">
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
            const isPending = qr.status === 'PENDING' || qr.status === 'Pending';
            const isMutating =
              (approveMutation.isPending && approveMutation.variables === qr.id) ||
              (declineMutation.isPending && declineMutation.variables === qr.id);

            return (
              <ResponseCard
                key={qr.id}
                response={qr}
                isPending={isPending}
                isMutating={isMutating}
                onApprove={() => approveMutation.mutate(qr.id)}
                onDecline={() => declineMutation.mutate(qr.id)}
                onMessageClick={() =>
                  navigate(
                    `${RFQ_ROUTES.quoteResponseDetail.replace(':id', rfqId).replace(':quoteId', qr.id)}?tab=messages`,
                  )
                }
                onAttachmentClick={() =>
                  navigate(
                    `${RFQ_ROUTES.quoteResponseDetail.replace(':id', rfqId).replace(':quoteId', qr.id)}?tab=attachments`,
                  )
                }
                onCardClick={() =>
                  navigate(
                    `${RFQ_ROUTES.quoteResponseDetail.replace(':id', rfqId).replace(':quoteId', qr.id)}?tab=lineItems`,
                  )
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Response Card ──────────────────────────────────────────────────────────

interface ResponseCardProps {
  response: QuoteResponse;
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
  isPending,
  isMutating,
  onApprove,
  onDecline,
  onMessageClick,
  onAttachmentClick,
  onCardClick,
}: ResponseCardProps) {
  const { t } = useTranslation('rfqs');
  const discountText = response.discountPercent
    ? `${response.discountPercent}%  (${formatCurrency(response.discountAmount ?? 0)})`
    : '-';

  const coverageText = `${response.itemsCovered} / ${response.totalItems} items`;
  const deliveryText = formatDeliveryDate(response.submittedAt);

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
        <Badge className="bg-[#e4e4e4] text-[#262626] border-0 rounded-full text-xs px-2 py-0.5">
          {formatStatus(response.status)}
        </Badge>
      </div>

      {/* Metadata: 2-column compact grid */}
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5">
        <MetaFieldCompact
          icon={<CoinsIcon className="w-4 h-4" />}
          value={formatCurrency(response.totalCost)}
        />
        <MetaFieldCompact icon={<CoinsIcon className="w-4 h-4" />} value={discountText} />
        <MetaFieldCompact icon={<PackageIcon className="w-4 h-4" />} value={coverageText} />
        <MetaFieldCompact icon={<DateIcon className="w-4 h-4" />} value={deliveryText} />
      </div>

      {/* Footer: buttons left + icons right */}
      <div className="mt-3 flex items-center justify-between">
        {/* Approve / Decline buttons */}
        {isPending ? (
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
        ) : (
          <div />
        )}

        {/* Message + attachment icons */}
        <div
          className="flex items-center gap-1"
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <MessageBadgeIcon hasNotification={false} onClick={onMessageClick} />
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            onClick={onAttachmentClick}
          >
            <PaperclipIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Meta Field (compact — icon + value only) ──────────────────────────────

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
