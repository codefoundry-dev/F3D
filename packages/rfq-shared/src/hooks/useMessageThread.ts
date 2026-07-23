import {
  type MessageItem as ApiMessageItem,
  createThread,
  getMessages,
  getThreads,
  sendMessage,
} from '@forethread/api-client';
import type { MessageItem } from '@forethread/ui-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Context documents that support threaded in-app messaging (FOR-288).
 * `QUOTE_RESPONSE` scopes an RFQ conversation to a single vendor's quote so
 * competing vendors never share a thread.
 */
export type MessageContextType = 'PURCHASE_ORDER' | 'RFQ' | 'QUOTE_RESPONSE';

/**
 * A message shaped for the shared chat tabs: the ui-components display fields
 * ({@link MessageItem} — sender name, body, company name + logo for branding)
 * plus the sender avatar and attachments the richer surfaces render.
 */
export interface ThreadMessage extends MessageItem {
  senderAvatarUrl?: string;
  attachments: ApiMessageItem['attachments'];
}

function toThreadMessage(msg: ApiMessageItem): ThreadMessage {
  return {
    id: msg.id,
    senderName: msg.sender.name,
    senderAvatarUrl: msg.sender.avatarUrl,
    senderCompany: msg.sender.companyName ?? null,
    senderCompanyLogoUrl: msg.sender.companyLogoUrl ?? null,
    body: msg.content,
    createdAt: msg.createdAt,
    attachments: msg.attachments,
  };
}

export interface UseMessageThreadOptions {
  contextType: MessageContextType;
  /** Id of the context document (PO id / RFQ id). Messaging stays idle until set. */
  contextId?: string;
  /**
   * Counterparty user ids to seed a brand-new thread with. The authenticated
   * user is always added server-side, so only the *other* parties belong here.
   */
  participantIds?: Array<string | null | undefined>;
  /** Set false to keep the queries idle (e.g. while a parent is still loading). */
  enabled?: boolean;
}

export interface UseMessageThreadResult {
  messages: ThreadMessage[];
  isLoading: boolean;
  isSending: boolean;
  /** Create the thread on first use if needed, then post `content`. */
  send: (content: string) => Promise<void>;
}

/**
 * Thread lifecycle for an in-app messaging surface (FOR-288): find-or-create the
 * single thread for a context document, poll its messages, and post replies —
 * mapping the API payload to the branded {@link ThreadMessage} shape the shared
 * chat tabs render. Mirrors the wiring proven in `PoMessagesTab`, extracted so
 * the PO Comms and RFQ quote message tabs render live, branded data too instead
 * of their previous empty-array stubs.
 */
export function useMessageThread({
  contextType,
  contextId,
  participantIds = [],
  enabled = true,
}: UseMessageThreadOptions): UseMessageThreadResult {
  const queryClient = useQueryClient();
  const isEnabled = enabled && Boolean(contextId);
  const threadsKey = ['message-threads', contextType, contextId];

  // 1. Find the context document's thread (one thread per document).
  const { data: threadsData, isLoading: isLoadingThreads } = useQuery({
    queryKey: threadsKey,
    queryFn: () => getThreads({ contextType, contextId, limit: 1 }),
    enabled: isEnabled,
  });

  const threadId = threadsData?.items?.[0]?.id ?? null;

  // 2. Poll the thread's messages while it is open.
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['messages', threadId],
    queryFn: () => getMessages(threadId!, { limit: 100 }),
    enabled: !!threadId,
    refetchInterval: 15000,
  });

  const messages = (messagesData?.items ?? []).map(toThreadMessage);

  // 3. Post a message, creating the thread on first send. Creating the thread
  //    returns its id, so the very first message posts in a single action —
  //    without the "click send twice" the original stubs would have needed.
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      let id = threadId;
      if (!id) {
        const seed = Array.from(new Set(participantIds.filter((p): p is string => Boolean(p))));
        const thread = await createThread({
          contextType,
          contextId: contextId!,
          participantIds: seed,
        });
        id = thread.id;
      }
      return sendMessage(id, { content });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: threadsKey });
      if (threadId) void queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
    },
  });

  const send = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || !contextId) return;
      await sendMutation.mutateAsync(text);
    },
    [contextId, sendMutation],
  );

  return {
    messages,
    isLoading: isLoadingThreads || (!!threadId && isLoadingMessages),
    isSending: sendMutation.isPending,
    send,
  };
}
