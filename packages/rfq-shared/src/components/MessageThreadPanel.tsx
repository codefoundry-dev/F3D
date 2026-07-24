import { useTranslation } from '@forethread/i18n';
import {
  Button,
  Input,
  Spinner,
  formatTime,
  formatDateLabel,
  groupMessagesByDate,
} from '@forethread/ui-components';
import PaperPlaneIcon from '@forethread/ui-components/assets/icons/paper-plane.svg?react';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useMessageThread, type MessageContextType } from '../hooks/useMessageThread';

export interface MessageThreadPanelProps {
  contextType: MessageContextType;
  /** Context document id (e.g. quoteResponseId). The panel stays idle until set. */
  contextId?: string;
  /** When true, the composer is replaced by a read-only notice (e.g. closed RFQ). */
  readOnly?: boolean;
  /** Container height (default h-[420px]). */
  height?: string;
}

/**
 * Self-contained, branded chat panel for a single message thread (FOR-288).
 * Wraps {@link useMessageThread} with the shared chat rendering — company-logo
 * avatar + "{rep} · {company}", date separators, attachments, and a compose box
 * that creates the thread on first send. Used by the vendor RFQ quote surface so
 * vendors can view and reply to the buyer's messages about their quote.
 */
export function MessageThreadPanel({
  contextType,
  contextId,
  readOnly = false,
  height,
}: MessageThreadPanelProps) {
  const { t } = useTranslation('rfqs');
  const [messageText, setMessageText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, isSending, send } = useMessageThread({ contextType, contextId });

  // Auto-scroll to the newest message.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!messageText.trim()) return;
    try {
      await send(messageText);
      setMessageText('');
    } catch {
      // Keep the text in the box so the user can retry a failed send.
    }
  }, [messageText, send]);

  const grouped = groupMessagesByDate(messages);

  return (
    <div
      className={`rounded-[10px] border border-foreground/10 bg-card flex flex-col ${height ?? 'h-[420px]'}`}
    >
      {/* Message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : grouped.size === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t('quoteResponseDetail.noMessages')}
          </p>
        ) : (
          Array.from(grouped.entries()).map(([dateKey, msgs]) => (
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
                        <span className="text-sm font-medium text-foreground">
                          {msg.senderName}
                        </span>
                        {msg.senderCompany && (
                          <span className="text-xs text-muted-foreground">
                            · {msg.senderCompany}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-1 whitespace-pre-line leading-relaxed">
                        {msg.body}
                      </p>
                      {msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {msg.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={`/api/v1/storage/files/${att.fileId}/download`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary underline"
                            >
                              {att.filename}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      {readOnly ? (
        <div className="border-t border-border px-4 py-3 text-center">
          <p className="text-sm text-muted-foreground">
            {t('quoteResponseDetail.readOnly', 'This RFQ is closed. Messages are read-only.')}
          </p>
        </div>
      ) : (
        <div className="border-t border-border p-3 flex items-center gap-3">
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && messageText.trim() && !isSending) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={t('quoteResponseDetail.typeMessage')}
            leftIcon={<PaperclipIcon className="w-5 h-5" />}
            className="flex-1 h-12"
            disabled={isSending}
          />
          <Button
            variant="primary"
            size="lg"
            className="h-12 px-8 rounded-xl"
            onClick={() => void handleSend()}
            disabled={!messageText.trim() || isSending}
            leftIcon={<PaperPlaneIcon className="w-5 h-5" />}
          >
            {t('quoteResponseDetail.send')}
          </Button>
        </div>
      )}
    </div>
  );
}
