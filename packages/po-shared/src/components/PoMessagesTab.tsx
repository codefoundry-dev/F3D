import { useTranslation } from '@forethread/i18n';
import { MessageAttachmentLinks, MessageComposer, useMessageThread } from '@forethread/rfq-shared';
import {
  Spinner,
  formatTime,
  formatDateLabel,
  groupMessagesByDate,
} from '@forethread/ui-components';
import { useEffect, useRef } from 'react';

const CLOSED_STATUSES = ['CLOSED', 'CANCELLED'];

interface PoMessagesTabProps {
  poId?: string;
  poStatus?: string;
  /** Unused — the server always adds the caller. Kept so call sites compile. */
  currentUserId?: string;
  /** PO creator id — seeds a brand-new thread. The vendor side is seeded
   * server-side from the PO (the client only has the vendor *company* id,
   * which is not a valid participant), so it is intentionally not passed. */
  creatorUserId?: string;
  /** Override container height (default 520px, use smaller for panels) */
  height?: string;
}

export function PoMessagesTab({ poId, poStatus, creatorUserId, height }: PoMessagesTabProps) {
  const { t } = useTranslation('purchaseOrders');
  const scrollRef = useRef<HTMLDivElement>(null);

  const isReadOnly = CLOSED_STATUSES.includes(poStatus ?? '');

  // Thread lifecycle via the shared hook: find the PO's thread (the server
  // joins any viewer who can see the PO, so colleagues and vendor reps get the
  // existing conversation), poll messages, and create-then-post in a single
  // action on first send — the previous inline wiring silently dropped the
  // first message and required a second Send click.
  const { messages, isLoading, isSending, send } = useMessageThread({
    contextType: 'PURCHASE_ORDER',
    contextId: poId,
    participantIds: [creatorUserId],
  });

  const grouped = groupMessagesByDate(messages);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // If no poId provided, show placeholder
  if (!poId) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        {t('messagesTab.comingSoon', 'Messages coming soon')}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div
      className={`rounded-[10px] border border-foreground/10 bg-card flex flex-col ${height ?? 'h-[520px]'}`}
    >
      {/* Message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {grouped.size === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t('comms.noMessages', 'No messages yet')}
          </p>
        )}

        {Array.from(grouped.entries()).map(([dateKey, msgs]) => (
          <div key={dateKey}>
            {/* Date separator */}
            <div className="flex items-center gap-8 my-2">
              <div className="flex-1 border-t border-border" />
              <span className="text-sm text-foreground bg-muted px-3 py-0.5 rounded-full">
                {formatDateLabel(msgs[0].createdAt)}
              </span>
              <div className="flex-1 border-t border-border" />
            </div>

            <div className="space-y-0">
              {msgs.map((msg) => (
                <div
                  key={msg.id}
                  className="flex gap-3 p-2 border-b border-border/50 last:border-b-0"
                >
                  {/* Avatar — sender's company logo (FOR-288), falling back to an initial */}
                  {msg.senderCompanyLogoUrl ? (
                    <img
                      src={msg.senderCompanyLogoUrl}
                      alt={msg.senderCompany ?? msg.senderName}
                      className="w-7 h-7 rounded-full object-contain bg-white border border-border shrink-0"
                    />
                  ) : msg.senderAvatarUrl ? (
                    <img
                      src={msg.senderAvatarUrl}
                      alt={msg.senderName}
                      className="w-7 h-7 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-medium text-muted-foreground">
                      {msg.senderName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-foreground">{msg.senderName}</span>
                      {msg.senderCompany && (
                        <span className="text-xs text-muted-foreground">· {msg.senderCompany}</span>
                      )}
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-line leading-relaxed">
                      {msg.body}
                    </p>
                    <MessageAttachmentLinks attachments={msg.attachments} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Message input */}
      {isReadOnly ? (
        <div className="border-t border-border px-4 py-3 text-center">
          <p className="text-sm text-muted-foreground">
            {t('comms.readOnly', 'This document is closed. Messages are read-only.')}
          </p>
        </div>
      ) : (
        <MessageComposer
          send={send}
          isSending={isSending}
          placeholder={t('comms.typeMessage')}
          sendLabel={t('comms.send')}
        />
      )}
    </div>
  );
}
