import type {
  QuoteResponseDetail,
  QuoteResponseLineItem,
  RfqDocument,
} from '@forethread/api-client';
import { declineQuote, openFileInNewTab } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Badge,
  Button,
  Spinner,
  cn,
  formatCurrency,
  formatStatus,
  formatTime,
  formatDateLabel,
  groupMessagesByDate,
  toast,
  ScrollTable,
} from '@forethread/ui-components';
import BackArrowIcon from '@forethread/ui-components/assets/icons/back-arrow.svg?react';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useApproveQuote } from '../hooks/useApproveQuote';
import { NOTE_POPOVER_ATTR, useDismissNotePopover } from '../hooks/useDismissNotePopover';
import { useMessageThread, type ThreadMessage } from '../hooks/useMessageThread';
import {
  useQuoteDetail,
  useRfqQuoteComparison,
  useUpdateQuoteLineItemStatuses,
} from '../hooks/useRfqs';

import { DeliveryVarianceBadge } from './DeliveryVarianceBadge';
import { DocumentRow } from './DocumentCard';
import { MaterialImageThumb } from './MaterialImageThumb';
import { MessageAttachmentLinks } from './MessageAttachmentLinks';
import { MessageComposer } from './MessageComposer';

// ── Design tokens (sampled from the 5.06 Figma frames) ─────────────────────────

const ROW_BEST_PRICE_BG = 'bg-[#E5F6EB]';
const ROW_SUBSTITUTE_BG = 'bg-[#FFF2B5]';
const ROW_REPLACED_BG = 'bg-[#FF959A]';
const SUGGESTION_BAND_BG = 'bg-[#F0C352]';

// ── Types ─────────────────────────────────────────────────────────────────────

export type QuoteResponseTab = 'messages' | 'lineItems' | 'attachments';

type Message = ThreadMessage;

export interface QuoteResponseDetailPageProps {
  rfqId: string;
  quoteId: string;
  /** Vendor display name (from the RFQ detail payload). */
  vendorName: string;
  /** Quote status (from the RFQ detail payload). */
  status: string;
  layout?: 'page' | 'panel';
  initialTab?: QuoteResponseTab;
  /** Called when the user switches tabs — use to sync the URL query param */
  onTabChange?: (tab: QuoteResponseTab) => void;
  /** Panel layout: navigate back to the responses list. */
  onBack?: () => void;
  /** Hide the Decline/Approve pair (the panel renders them in its own header). */
  hideActions?: boolean;
}

// ── Quote-level Decline / Approve (with the post-approve PO prompt) ────────────

export interface QuoteResponseActionsProps {
  rfqId: string;
  quoteId: string;
  status: string;
  size?: 'sm' | 'md';
}

/**
 * Decline / Approve buttons for a vendor quote, including the post-approve
 * "Do you want to start PO creation?" prompt (US 5.19). Shared between the
 * quote drill-in page and the RFQ detail side panel header.
 */
export function QuoteResponseActions({
  rfqId,
  quoteId,
  status,
  size = 'md',
}: QuoteResponseActionsProps) {
  const { t } = useTranslation('rfqs');
  const queryClient = useQueryClient();
  // Approving awards the quote and opens its new draft PO (FOR-396).
  const approveQuote = useApproveQuote(rfqId);

  const declineMutation = useMutation({
    mutationFn: () => declineQuote(rfqId, quoteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rfqs', rfqId] });
    },
  });

  const isMutating = approveQuote.isPending || declineMutation.isPending;
  const isPending = status.toUpperCase() === 'PENDING' || status.toUpperCase() === 'SUBMITTED';

  if (!isPending) return null;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size={size}
        disabled={isMutating}
        onClick={() => declineMutation.mutate()}
        leftIcon={<CrossInCircleIcon className="w-[18px] h-[18px]" />}
      >
        {t('responsesTab.decline')}
      </Button>
      <Button
        variant="outline"
        size={size}
        disabled={isMutating}
        onClick={() => approveQuote.approve(quoteId)}
        leftIcon={<CheckCircleIcon className="w-[18px] h-[18px]" />}
      >
        {t('responsesTab.approve')}
      </Button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * US 5.06 — drill-in view of a single vendor quote with Messages / Quote Line
 * Items / Attachments tabs, per-line review actions, suggestion-replace
 * handling and the quote totals footer. Rendered as a full page and embedded
 * inside the RFQ detail side panel.
 */
export function QuoteResponseDetailPage({
  rfqId,
  quoteId,
  vendorName,
  status,
  layout = 'page',
  initialTab = 'messages',
  onTabChange,
  onBack,
  hideActions = false,
}: QuoteResponseDetailPageProps) {
  const isPanel = layout === 'panel';
  const { t } = useTranslation('rfqs');
  const [activeTab, setActiveTabState] = useState<QuoteResponseTab>(initialTab);

  const { data: quote, isLoading, isError } = useQuoteDetail(rfqId, quoteId);

  const setActiveTab = (tab: QuoteResponseTab) => {
    setActiveTabState(tab);
    onTabChange?.(tab);
  };

  // Live message thread for this vendor's quote (FOR-288) — replaces the
  // empty-array stub. Scoped to the QuoteResponse (not the RFQ) so each
  // buyer↔vendor conversation is isolated; the backend seeds the vendor's
  // sales reps as participants.
  const {
    messages,
    isLoading: isLoadingMessages,
    isSending,
    send,
  } = useMessageThread({ contextType: 'QUOTE_RESPONSE', contextId: quoteId });

  const attachments = quote?.attachments ?? [];

  const tabs: { key: QuoteResponseTab; label: string }[] = [
    { key: 'messages', label: `${t('quoteResponseDetail.messages')} (${messages.length})` },
    { key: 'lineItems', label: t('quoteResponseDetail.quoteLineItems') },
    {
      key: 'attachments',
      label: `${t('quoteResponseDetail.attachments')} (${attachments.length})`,
    },
  ];

  const actionButtons = !hideActions && (
    <QuoteResponseActions
      rfqId={rfqId}
      quoteId={quoteId}
      status={status}
      size={isPanel ? 'sm' : 'md'}
    />
  );

  const tabChips = (
    <div className="flex gap-2">
      {tabs.map((tab) => (
        <Button
          key={tab.key}
          variant={activeTab === tab.key ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setActiveTab(tab.key)}
          className="rounded-full"
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );

  const content = isLoading ? (
    <div className="flex justify-center py-16">
      <Spinner size="lg" />
    </div>
  ) : isError || !quote ? (
    <p className="py-8 text-sm text-muted-foreground">{t('quoteResponseDetail.loadError')}</p>
  ) : (
    <>
      {activeTab === 'messages' && (
        <MessagesTab
          messages={messages}
          isLoading={isLoadingMessages}
          isSending={isSending}
          send={send}
        />
      )}
      {activeTab === 'lineItems' && (
        <QuoteLineItemsTab rfqId={rfqId} quote={quote} layout={layout} />
      )}
      {activeTab === 'attachments' &&
        (attachments.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t('quoteResponseDetail.noAttachments')}
          </p>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            {attachments.map((att) => (
              <DocumentRow
                key={att.id}
                doc={
                  {
                    id: att.id,
                    name: att.filename,
                    fileId: att.fileId,
                    uploadedBy: { name: vendorName, email: '', avatarUrl: null },
                    uploadedAt: quote.submittedAt ?? '',
                  } as RfqDocument
                }
                onView={(doc) => {
                  if (doc.fileId) void openFileInNewTab(doc.fileId);
                }}
              />
            ))}
          </div>
        ))}
    </>
  );

  if (isPanel) {
    /* Panel layout: back arrow + vendor name + status, then chip tabs. */
    return (
      <div className="flex flex-col h-full gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-foreground hover:bg-accent transition-colors shrink-0"
          >
            <BackArrowIcon className="w-4 h-4" />
          </button>
          <h3 className="flex-1 text-base font-semibold text-foreground truncate">{vendorName}</h3>
          <Badge className="bg-[#E8EAED] text-[#2D3139] border-0 rounded-full text-xs px-2 py-0.5 shrink-0">
            {formatStatus(status)}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {tabChips}
          {actionButtons}
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">{content}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs + Actions */}
      <div className="px-4 pt-4 pb-4 md:px-8 md:pt-6">
        <div className="flex items-center justify-between">
          {tabChips}
          {actionButtons}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 pb-8 md:px-8">{content}</div>
    </div>
  );
}

// ── Messages Tab ──────────────────────────────────────────────────────────────

function MessagesTab({
  messages,
  isLoading,
  isSending,
  send,
}: {
  messages: Message[];
  isLoading: boolean;
  isSending: boolean;
  send: (content: string, attachmentIds?: string[]) => Promise<void>;
}) {
  const { t } = useTranslation('rfqs');
  const grouped = groupMessagesByDate(messages);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-6">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('quoteResponseDetail.noMessages')}
          </p>
        )}
        {Array.from(grouped.entries()).map(([dateKey, msgs]) => (
          <div key={dateKey}>
            {/* Date separator */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 border-t border-border" />
              <span className="text-xs text-muted-foreground bg-white px-3 py-1 rounded-full border border-border">
                {formatDateLabel(msgs[0].createdAt)}
              </span>
              <div className="flex-1 border-t border-border" />
            </div>

            <div className="space-y-4">
              {msgs.map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  {/* Avatar — sender's company logo (FOR-288), falling back to an initial */}
                  {msg.senderCompanyLogoUrl ? (
                    <img
                      src={msg.senderCompanyLogoUrl}
                      alt={msg.senderCompany ?? msg.senderName}
                      className="w-8 h-8 rounded-full object-contain bg-white border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-medium text-muted-foreground">
                      {msg.senderName.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {msg.senderName}
                      </span>
                      {msg.senderCompany && (
                        <span className="text-xs text-muted-foreground">· {msg.senderCompany}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-line">{msg.body}</p>
                    <MessageAttachmentLinks attachments={msg.attachments} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Message input */}
      <MessageComposer
        send={send}
        isSending={isSending}
        placeholder={t('quoteResponseDetail.typeMessage')}
        sendLabel={t('quoteResponseDetail.send')}
        variant="page"
      />
    </div>
  );
}

// ── Quote Line Items Tab ──────────────────────────────────────────────────────

function lineDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US');
}

function lineName(li: QuoteResponseLineItem): string {
  return li.rfqLineItem?.materialName ?? li.rfqLineItem?.material?.name ?? '-';
}

function lineDiscountText(li: QuoteResponseLineItem, currency: string): string {
  if (li.discount === null) return '-';
  if (li.discountType === 'AMOUNT') return formatCurrency(li.discount, currency);
  const amount = (li.unitPrice * li.quotedQuantity * li.discount) / 100;
  return `${li.discount}% (${formatCurrency(amount, currency)})`;
}

function QuoteLineItemsTab({
  rfqId,
  quote,
  layout,
}: {
  rfqId: string;
  quote: QuoteResponseDetail;
  layout: 'page' | 'panel';
}) {
  const { t } = useTranslation('rfqs');
  const isPanel = layout === 'panel';
  const { data: comparison } = useRfqQuoteComparison(rfqId);
  const currency = comparison?.currency ?? 'AUD';
  const lineStatusMutation = useUpdateQuoteLineItemStatuses(rfqId);
  const [openNoteLine, setOpenNoteLine] = useState<string | null>(null);
  const closeNote = useCallback(() => setOpenNoteLine(null), []);
  useDismissNotePopover(openNoteLine !== null, closeNote);

  // Lines this vendor priced lowest across all received quotes (green + tag).
  const lowestLineIds = new Set(
    (comparison?.rows ?? [])
      .flatMap((row) => row.cells)
      .filter((cell) => cell.quoteResponseId === quote.id && cell.isLowest)
      .map((cell) => cell.quoteLineItemId),
  );

  const setLineStatus = useCallback(
    (lineItemId: string, status: 'APPROVED' | 'DECLINED' | 'PENDING') => {
      lineStatusMutation.mutate(
        { quoteId: quote.id, lineItemIds: [lineItemId], status },
        { onError: () => toast.error(t('reviewTable.lineStatusUpdateError')) },
      );
    },
    [lineStatusMutation, quote.id, t],
  );

  const quotedLines = quote.lineItems.filter((li) => li.availability !== 'NO_QUOTE');
  const regularLines = quotedLines.filter((li) => !li.substituteItemId);
  const substitutionLines = quotedLines.filter((li) => li.substituteItemId);

  if (quotedLines.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t('quoteResponseDetail.noLineItems')}
      </p>
    );
  }

  const deliveryDates = quotedLines
    .map((li) => (li.deliveryDate ? new Date(li.deliveryDate).getTime() : null))
    .filter((d): d is number => d !== null);
  const footerDelivery = quote.bulkDeliveryTime
    ? new Date(quote.bulkDeliveryTime)
    : deliveryDates.length > 0
      ? new Date(Math.max(...deliveryDates))
      : null;

  const colCount = 7;

  const cellClass = (extra?: string | false) =>
    cn('border-b border-foreground/10 px-3 py-3 text-sm text-foreground whitespace-nowrap', extra);

  function renderActions(li: QuoteResponseLineItem) {
    const noteButton = (
      <span className="relative inline-flex" {...{ [NOTE_POPOVER_ATTR]: '' }}>
        <button
          type="button"
          title={t('reviewTable.viewNote')}
          onClick={() => setOpenNoteLine(openNoteLine === li.id ? null : li.id)}
          className="relative text-foreground/70 hover:text-foreground transition-colors"
        >
          <EditIcon className="w-4 h-4" />
          {li.notes && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-destructive" />
          )}
        </button>
        {openNoteLine === li.id && (
          <div className="absolute right-0 top-6 z-50 w-56 rounded-xl border border-border bg-card p-3 text-left text-xs text-card-foreground shadow-lg whitespace-pre-line">
            {li.notes ?? t('reviewTable.noNote')}
          </div>
        )}
      </span>
    );

    if (li.status === 'APPROVED' || li.status === 'DECLINED') {
      return (
        <div className="flex items-center gap-2.5">
          {noteButton}
          <button
            type="button"
            title={t('reviewTable.restoreLine')}
            onClick={() => setLineStatus(li.id, 'PENDING')}
            className="text-foreground/70 hover:text-foreground transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
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
          onClick={() => setLineStatus(li.id, 'APPROVED')}
          className="text-foreground/70 hover:text-foreground transition-colors"
        >
          <CheckCircleIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          title={t('reviewTable.declineLine')}
          onClick={() => setLineStatus(li.id, 'DECLINED')}
          className="text-foreground/70 hover:text-foreground transition-colors"
        >
          <CrossInCircleIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  function renderLineRow(li: QuoteResponseLineItem, opts?: { struck?: boolean; bg?: string }) {
    const isLowest = lowestLineIds.has(li.id);
    const bg = opts?.bg ?? (isLowest ? ROW_BEST_PRICE_BG : undefined);
    const struck = opts?.struck ?? false;
    const textCls = struck ? 'line-through' : undefined;
    // The struck row is the requested material; the row under it (and any row
    // where a substitute's name is shown) is the vendor's proposed substitute.
    // The image follows whichever material the name belongs to (FOR-402).
    const substituteName = struck ? undefined : li.substituteItem?.name;
    const name = substituteName ?? lineName(li);
    const imageUrl =
      substituteName !== undefined
        ? li.substituteItem?.imageUrl
        : li.rfqLineItem?.material?.imageUrl;
    return (
      <tr key={`${li.id}${struck ? '-orig' : ''}`} className={bg}>
        <td className={cellClass(cn('font-normal', textCls))}>
          <span className="flex items-center gap-2">
            <MaterialImageThumb url={imageUrl} name={name} />
            {name}
          </span>
        </td>
        <td className={cellClass(textCls)}>
          <span className="inline-flex items-center gap-1.5">
            {formatCurrency(li.unitPrice, currency)}
            {!struck && isLowest && !li.substituteItemId && (
              <svg viewBox="0 0 18 18" fill="none" className="w-[18px] h-[18px] text-[#00A63E]">
                <path
                  d="M2.25 8.25V3.187a.937.937 0 0 1 .937-.937H8.25c.249 0 .487.099.663.274l6.188 6.188a.937.937 0 0 1 0 1.326l-5.063 5.064a.937.937 0 0 1-1.326 0L2.524 8.913a.937.937 0 0 1-.274-.663Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="5.625" cy="5.625" r="0.9" fill="currentColor" />
              </svg>
            )}
          </span>
        </td>
        <td className={cellClass(textCls)}>
          {li.quotedQuantity}/{li.rfqLineItem?.quantity ?? '-'} {li.rfqLineItem?.unit ?? ''}
        </td>
        <td className={cellClass(textCls)}>{lineDiscountText(li, currency)}</td>
        <td className={cellClass(textCls)}>{formatCurrency(li.lineTotal, currency)}</td>
        <td className={cellClass(textCls)}>
          <span className="flex items-center gap-1.5">
            {lineDate(li.deliveryDate)}
            {!struck && <DeliveryVarianceBadge days={li.deliveryVarianceDays} />}
          </span>
          {/* FOR-392: what the buyer asked for, beside what the vendor quoted. */}
          {!struck && li.expectedDeliveryDate && (
            <span className="block text-xs text-muted-foreground">
              {t('deliveryVariance.expected')}: {lineDate(li.expectedDeliveryDate)}
            </span>
          )}
        </td>
        <td className={cellClass()}>{!struck && renderActions(li)}</td>
      </tr>
    );
  }

  return (
    <ScrollTable className="rounded-lg border border-foreground/10">
      <table
        className={cn(
          'border-separate border-spacing-0 text-sm w-full',
          isPanel && 'w-max min-w-full',
        )}
      >
        <thead>
          <tr className="bg-[#F2F2F2]">
            <th className="px-3 py-3 text-left text-sm font-medium text-[#1B1D22] border-b border-foreground/10 min-w-[180px]">
              {t('quoteResponseDetail.item')}
            </th>
            <th className="px-3 py-3 text-left text-sm font-medium text-[#1B1D22] border-b border-foreground/10 min-w-[100px]">
              {t('quoteResponseDetail.priceUnit')}
            </th>
            <th className="px-3 py-3 text-left text-sm font-medium text-[#1B1D22] border-b border-foreground/10 min-w-[150px]">
              {t('quoteResponseDetail.quantityAvailable')}
            </th>
            <th className="px-3 py-3 text-left text-sm font-medium text-[#1B1D22] border-b border-foreground/10 min-w-[120px]">
              {t('quoteResponseDetail.discount')}
            </th>
            <th className="px-3 py-3 text-left text-sm font-medium text-[#1B1D22] border-b border-foreground/10 min-w-[140px]">
              {t('quoteResponseDetail.lineTotalWithTax')}
            </th>
            <th className="px-3 py-3 text-left text-sm font-medium text-[#1B1D22] border-b border-foreground/10 min-w-[150px]">
              {t('quoteResponseDetail.deliveryDate')}
            </th>
            <th className="px-3 py-3 text-left text-sm font-medium text-[#1B1D22] border-b border-foreground/10 min-w-[92px]">
              {t('quoteResponseDetail.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {regularLines.map((li) => renderLineRow(li))}

          {substitutionLines.length > 0 && (
            <>
              <tr className={SUGGESTION_BAND_BG}>
                <td colSpan={colCount} className="px-3 py-2 border-b border-foreground/10">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">
                      {t('quoteResponseDetail.suggestionReplace')}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          lineStatusMutation.mutate(
                            {
                              quoteId: quote.id,
                              lineItemIds: substitutionLines.map((li) => li.id),
                              status: 'DECLINED',
                            },
                            {
                              onError: () => toast.error(t('reviewTable.lineStatusUpdateError')),
                            },
                          )
                        }
                        className="flex items-center gap-1.5 h-8 px-3 bg-card border border-black rounded-xl text-sm font-medium text-black hover:bg-black/5 transition-colors"
                      >
                        <CrossInCircleIcon className="w-4 h-4" />
                        {t('responsesTab.decline')}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          lineStatusMutation.mutate(
                            {
                              quoteId: quote.id,
                              lineItemIds: substitutionLines.map((li) => li.id),
                              status: 'APPROVED',
                            },
                            {
                              onError: () => toast.error(t('reviewTable.lineStatusUpdateError')),
                            },
                          )
                        }
                        className="flex items-center gap-1.5 h-8 px-3 bg-card border border-black rounded-xl text-sm font-medium text-black hover:bg-black/5 transition-colors"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        {t('responsesTab.approve')}
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
              {substitutionLines.map((li) => [
                renderLineRow(li, { struck: true, bg: ROW_REPLACED_BG }),
                renderLineRow(li, { bg: ROW_SUBSTITUTE_BG }),
              ])}
            </>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-[#F2F2F2]">
            <td colSpan={colCount} className="px-3 py-3">
              <div className="flex flex-wrap items-center gap-x-10 gap-y-2">
                <div>
                  <div className="text-sm text-foreground">{t('quoteResponseDetail.delivery')}</div>
                  <div className="text-sm font-semibold text-foreground">
                    {footerDelivery
                      ? footerDelivery.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '-'}
                  </div>
                </div>
                {quote.bulkShipment !== null && (
                  <div>
                    <div className="text-sm text-foreground">
                      {t('quoteResponseDetail.shipmentHandling')}
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {formatCurrency(quote.bulkShipment, currency)}
                    </div>
                  </div>
                )}
                {(quote.discountPercent ?? quote.bulkDiscount) !== null && (
                  <div>
                    <div className="text-sm text-foreground">
                      {t('quoteResponseDetail.discount')}
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {quote.discountPercent ?? quote.bulkDiscount}%
                    </div>
                  </div>
                )}
                <div className="ml-auto">
                  <div className="text-sm text-foreground">
                    {t('quoteResponseDetail.totalWithTaxes')}
                  </div>
                  <div className="text-base font-semibold text-foreground">
                    {formatCurrency(quote.totalCost, currency)}
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </ScrollTable>
  );
}
