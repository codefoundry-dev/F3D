import type { RfqDetail, RfqDocument } from '@forethread/api-client';
import { approveQuote, declineQuote, openFileInNewTab } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Button,
  Input,
  formatTime,
  formatDateLabel,
  groupMessagesByDate,
  type MessageItem,
} from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';
import LetterIcon from '@forethread/ui-components/assets/icons/letter.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { DocumentRow } from './DocumentCard';

// ── Types ─────────────────────────────────────────────────────────────────────

export type QuoteResponseTab = 'messages' | 'lineItems' | 'attachments';

type QuoteResponse = RfqDetail['quoteResponses'][number];

type Message = MessageItem;

export interface QuoteResponseDetailPageProps {
  rfqId: string;
  quoteResponse: QuoteResponse;
  initialTab?: QuoteResponseTab;
  /** Called when the user switches tabs — use to sync the URL query param */
  onTabChange?: (tab: QuoteResponseTab) => void;
  /** Optional line items from the RFQ to show in the Quote Line Items tab */
  lineItems?: RfqDetail['lineItems'];
  /** Documents from the RFQ to show in the Attachments tab */
  documents?: RfqDetail['documents'];
}

// ── Main Component ────────────────────────────────────────────────────────────

export function QuoteResponseDetailPage({
  rfqId,
  quoteResponse,
  initialTab = 'messages',
  onTabChange,
  lineItems = [],
  documents = [],
}: QuoteResponseDetailPageProps) {
  const { t } = useTranslation('rfqs');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTabState] = useState<QuoteResponseTab>(initialTab);
  const [messageText, setMessageText] = useState('');

  const setActiveTab = (tab: QuoteResponseTab) => {
    setActiveTabState(tab);
    onTabChange?.(tab);
  };

  const isPending = quoteResponse.status === 'PENDING' || quoteResponse.status === 'Pending';

  const approveMutation = useMutation({
    mutationFn: () => approveQuote(rfqId, quoteResponse.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rfqs', rfqId] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => declineQuote(rfqId, quoteResponse.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rfqs', rfqId] });
    },
  });

  const isMutating = approveMutation.isPending || declineMutation.isPending;

  // TODO: Replace with real messages from API when available
  const messages: Message[] = [];

  const handleViewDoc = useCallback(async (doc: RfqDocument) => {
    if (doc.fileId) {
      await openFileInNewTab(doc.fileId);
    }
  }, []);

  const tabs: { key: QuoteResponseTab; label: string }[] = [
    { key: 'messages', label: `${t('quoteResponseDetail.messages')} (${messages.length})` },
    { key: 'lineItems', label: t('quoteResponseDetail.quoteLineItems') },
    {
      key: 'attachments',
      label: `${t('quoteResponseDetail.attachments')} (${documents.length})`,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tabs + Actions */}
      <div className="px-8 pt-6 pb-4">
        <div className="flex items-center justify-between">
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

          {isPending && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="md"
                disabled={isMutating}
                onClick={() => declineMutation.mutate()}
                leftIcon={<CrossInCircleIcon className="w-[18px] h-[18px]" />}
              >
                {t('responsesTab.decline')}
              </Button>
              <Button
                variant="outline"
                size="md"
                disabled={isMutating}
                onClick={() => approveMutation.mutate()}
                leftIcon={<CheckCircleIcon className="w-[18px] h-[18px]" />}
              >
                {t('responsesTab.approve')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {activeTab === 'messages' && (
          <MessagesTab
            messages={messages}
            messageText={messageText}
            onMessageTextChange={setMessageText}
            onSend={() => {
              // TODO: send message via API
              setMessageText('');
            }}
          />
        )}
        {activeTab === 'lineItems' && <QuoteLineItemsTab lineItems={lineItems} />}
        {activeTab === 'attachments' &&
          (documents.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t('quoteResponseDetail.noAttachments')}
            </p>
          ) : (
            <div className="rounded-xl border border-border bg-card">
              {documents.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} onView={handleViewDoc} />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Messages Tab ──────────────────────────────────────────────────────────────

function MessagesTab({
  messages,
  messageText,
  onMessageTextChange,
  onSend,
}: {
  messages: Message[];
  messageText: string;
  onMessageTextChange: (text: string) => void;
  onSend: () => void;
}) {
  const { t } = useTranslation('rfqs');
  const grouped = groupMessagesByDate(messages);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-6">
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
                  {/* Avatar placeholder */}
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-medium text-muted-foreground">
                    {msg.senderName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {msg.senderName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-line">{msg.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Message input */}
      <div className="mt-6 flex items-center gap-3">
        <Input
          value={messageText}
          onChange={(e) => onMessageTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && messageText.trim()) {
              onSend();
            }
          }}
          placeholder={t('quoteResponseDetail.typeMessage')}
          leftIcon={<PaperclipIcon className="w-4 h-4" />}
        />
        <Button
          onClick={onSend}
          disabled={!messageText.trim()}
          leftIcon={<LetterIcon className="w-4 h-4" />}
        >
          {t('quoteResponseDetail.send')}
        </Button>
      </div>
    </div>
  );
}

// ── Quote Line Items Tab ──────────────────────────────────────────────────────

function QuoteLineItemsTab({ lineItems }: { lineItems: RfqDetail['lineItems'] }) {
  const { t } = useTranslation('rfqs');

  if (lineItems.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t('quoteResponseDetail.noLineItems')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-foreground/10 text-left">
            <th className="pb-2 pr-3 font-medium text-muted-foreground text-xs">
              {t('lineItemsTab.lineItemId')}
            </th>
            <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
              {t('lineItemsTab.materialName')}
            </th>
            <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
              {t('lineItemsTab.description')}
            </th>
            <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
              {t('lineItemsTab.qtyOrdered')}
            </th>
            <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
              {t('lineItemsTab.uom')}
            </th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item) => (
            <tr key={item.id} className="border-b border-foreground/10">
              <td className="py-2.5 pr-3 text-foreground">{item.id}</td>
              <td className="py-2.5 px-3 text-foreground">{item.materialName}</td>
              <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[160px]">
                {item.description ?? '-'}
              </td>
              <td className="py-2.5 px-3 text-foreground">{item.quantity}</td>
              <td className="py-2.5 px-3 text-muted-foreground">{item.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-start mt-3 pt-3 border-t border-foreground/10">
        <span className="text-sm text-muted-foreground">
          {t('lineItemsTab.totalItems')}:{' '}
          <span className="font-medium text-foreground">{lineItems.length}</span>
        </span>
      </div>
    </div>
  );
}
