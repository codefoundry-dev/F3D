import {
  type MessageItem as ApiMessageItem,
  createThread,
  getMessages,
  getThreads,
  sendMessage,
} from '@forethread/api-client';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

const CLOSED_STATUSES = ['CLOSED', 'CANCELLED'];

interface PoMessagesTabProps {
  poId?: string;
  poStatus?: string;
  /** Current user id — needed to auto-create thread with participants */
  currentUserId?: string;
  /** Vendor company user id — added as participant when creating thread */
  vendorUserId?: string;
  /** PO creator id — added as participant when creating thread */
  creatorUserId?: string;
  /** Override container height (default 520px, use smaller for panels) */
  height?: string;
}

/** Map API MessageItem to the shape used by groupMessagesByDate */
function toDisplayMessage(msg: ApiMessageItem) {
  return {
    id: msg.id,
    senderName: msg.sender.name,
    senderAvatarUrl: msg.sender?.avatarUrl,
    body: msg.content,
    createdAt: msg.createdAt,
    attachments: msg.attachments,
  };
}

type DisplayMessage = ReturnType<typeof toDisplayMessage>;

export function PoMessagesTab({
  poId,
  poStatus,
  currentUserId,
  vendorUserId,
  creatorUserId,
  height,
}: PoMessagesTabProps) {
  const { t } = useTranslation('purchaseOrders');
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const isReadOnly = CLOSED_STATUSES.includes(poStatus ?? '');

  // If no poId provided, show placeholder
  if (!poId) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        {t('messagesTab.comingSoon', 'Messages coming soon')}
      </div>
    );
  }

  // 1. Find or create thread for this PO
  const { data: threadsData, isLoading: isLoadingThreads } = useQuery({
    queryKey: ['message-threads', 'PURCHASE_ORDER', poId],
    queryFn: () => getThreads({ contextType: 'PURCHASE_ORDER', contextId: poId, limit: 1 }),
  });

  const threadId = threadsData?.items?.[0]?.id ?? null;

  // 2. Fetch messages for the thread
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['messages', threadId],
    queryFn: () => getMessages(threadId!, { limit: 100 }),
    enabled: !!threadId,
    refetchInterval: 15000,
  });

  const displayMessages: DisplayMessage[] = (messagesData?.items ?? []).map(toDisplayMessage);
  const grouped = groupMessagesByDate(displayMessages);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayMessages.length]);

  // 3. Create thread mutation (if none exists yet)
  const createThreadMutation = useMutation({
    mutationFn: () => {
      const participantIds = new Set<string>();
      if (currentUserId) participantIds.add(currentUserId);
      if (vendorUserId) participantIds.add(vendorUserId);
      if (creatorUserId) participantIds.add(creatorUserId);
      return createThread({
        contextType: 'PURCHASE_ORDER',
        contextId: poId,
        participantIds: Array.from(participantIds),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['message-threads', 'PURCHASE_ORDER', poId],
      });
    },
  });

  // 4. Send message mutation
  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(threadId!, { content }),
    onSuccess: () => {
      setMessageText('');
      void queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
    },
  });

  const handleSend = useCallback(async () => {
    const text = messageText.trim();
    if (!text) return;

    if (!threadId) {
      // Create thread first, then send after invalidation refreshes threadId
      await createThreadMutation.mutateAsync();
      // After thread creation, the query will refetch and threadId will be available
      // We'll let the user click send again (thread will exist on next render)
      return;
    }

    sendMutation.mutate(text);
  }, [messageText, threadId, createThreadMutation, sendMutation]);

  const isBusy = sendMutation.isPending || createThreadMutation.isPending;
  const isLoading = isLoadingThreads || (!!threadId && isLoadingMessages);

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
                  {/* Avatar */}
                  {msg.senderAvatarUrl ? (
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
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-line leading-relaxed">
                      {msg.body}
                    </p>
                    {/* Attachments */}
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
        <div className="border-t border-border p-3 flex items-center gap-3">
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && messageText.trim()) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={t('comms.typeMessage')}
            leftIcon={<PaperclipIcon className="w-5 h-5" />}
            className="flex-1 h-12"
            disabled={isBusy}
          />
          <Button
            variant="primary"
            size="lg"
            className="h-12 px-8 rounded-xl"
            onClick={() => void handleSend()}
            disabled={!messageText.trim() || isBusy}
            leftIcon={<PaperPlaneIcon className="w-5 h-5" />}
          >
            {t('comms.send')}
          </Button>
        </div>
      )}
    </div>
  );
}
