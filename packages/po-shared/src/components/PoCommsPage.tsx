import { type PoDetail, type RfqDocument, openFileInNewTab } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { DocumentRow } from '@forethread/rfq-shared';
import {
  Button,
  Input,
  formatTime,
  formatDateLabel,
  groupMessagesByDate,
  type MessageItem,
} from '@forethread/ui-components';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';
import LetterIcon from '@forethread/ui-components/assets/icons/letter.svg?react';
import { useCallback, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PoCommsTab = 'messages' | 'lineItems' | 'attachments';

type Message = MessageItem;

export interface PoCommsPageProps {
  po: PoDetail;
  initialTab?: PoCommsTab;
  onTabChange?: (tab: PoCommsTab) => void;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PoCommsPage({ po, initialTab = 'messages', onTabChange }: PoCommsPageProps) {
  const { t } = useTranslation('purchaseOrders');
  const [activeTab, setActiveTabState] = useState<PoCommsTab>(initialTab);
  const [messageText, setMessageText] = useState('');

  const setActiveTab = (tab: PoCommsTab) => {
    setActiveTabState(tab);
    onTabChange?.(tab);
  };

  // TODO: Replace with real messages from API when available
  const messages: Message[] = [];
  const documents = po.documents ?? [];
  const lineItems = po.lineItems ?? [];

  const handleViewDoc = useCallback(async (doc: RfqDocument) => {
    if (doc.fileId) {
      await openFileInNewTab(doc.fileId);
    }
  }, []);

  const tabs: { key: PoCommsTab; label: string }[] = [
    { key: 'messages', label: `${t('comms.messages')} (${messages.length})` },
    { key: 'lineItems', label: t('comms.lineItems') },
    { key: 'attachments', label: `${t('comms.attachments')} (${documents.length})` },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="px-8 pt-6 pb-4">
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
        {activeTab === 'lineItems' && <LineItemsTab lineItems={lineItems} />}
        {activeTab === 'attachments' && (
          <AttachmentsSection documents={documents} onView={handleViewDoc} />
        )}
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
  const { t } = useTranslation('purchaseOrders');
  const grouped = groupMessagesByDate(messages);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-6">
        {Array.from(grouped.entries()).map(([dateKey, msgs]) => (
          <div key={dateKey}>
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

      <div className="mt-6 flex items-center gap-3">
        <Input
          value={messageText}
          onChange={(e) => onMessageTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && messageText.trim()) {
              onSend();
            }
          }}
          placeholder={t('comms.typeMessage')}
          leftIcon={<PaperclipIcon className="w-4 h-4" />}
        />
        <Button
          onClick={onSend}
          disabled={!messageText.trim()}
          leftIcon={<LetterIcon className="w-4 h-4" />}
        >
          {t('comms.send')}
        </Button>
      </div>
    </div>
  );
}

// ── Line Items Tab ────────────────────────────────────────────────────────────

function LineItemsTab({ lineItems }: { lineItems: PoDetail['lineItems'] }) {
  const { t } = useTranslation('purchaseOrders');

  if (!lineItems || lineItems.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">{t('comms.noLineItems')}</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-foreground/10 text-left">
            <th className="pb-2 pr-3 font-medium text-muted-foreground text-xs">
              {t('lineItemsTab.lineNumber')}
            </th>
            <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
              {t('lineItemsTab.materialName')}
            </th>
            <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
              {t('lineItemsTab.qtyOrdered')}
            </th>
            <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
              {t('lineItemsTab.unitPrice')}
            </th>
            <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
              {t('lineItemsTab.lineTotal')}
            </th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, i) => (
            <tr key={item.id} className="border-b border-foreground/10">
              <td className="py-2.5 pr-3 text-foreground">{i + 1}</td>
              <td className="py-2.5 px-3 text-foreground">
                {item.materialName ?? item.description ?? '-'}
              </td>
              <td className="py-2.5 px-3 text-foreground">
                {item.quantityOrdered} {item.unitOfMeasure}
              </td>
              <td className="py-2.5 px-3 text-foreground">${Number(item.unitPrice).toFixed(2)}</td>
              <td className="py-2.5 px-3 text-foreground">
                ${(Number(item.unitPrice) * Number(item.quantityOrdered)).toFixed(2)}
              </td>
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

// ── Attachments Section ───────────────────────────────────────────────────────

function AttachmentsSection({
  documents,
  onView,
}: {
  documents: PoDetail['documents'];
  onView: (doc: RfqDocument) => void;
}) {
  const { t } = useTranslation('purchaseOrders');

  if (!documents || documents.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">{t('comms.noAttachments')}</p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      {documents.map((doc) => (
        <DocumentRow key={doc.id} doc={doc as unknown as RfqDocument} onView={onView} />
      ))}
    </div>
  );
}
