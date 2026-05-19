import { getApiClient } from '../client';

import { MESSAGES_PATHS } from './paths';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreateThreadInput {
  contextType: string;
  contextId: string;
  participantIds: string[];
}

export interface SendMessageInput {
  content: string;
  attachmentIds?: string[];
}

export interface ListThreadsParams {
  page?: number;
  limit?: number;
  contextType?: string;
  contextId?: string;
}

export interface ListMessagesParams {
  page?: number;
  limit?: number;
}

export interface MessageThread {
  id: string;
  contextType: string;
  contextId: string;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
  lastMessage?: {
    id: string;
    content: string;
    senderName: string;
    createdAt: string;
  };
}

export interface MessageItem {
  id: string;
  content: string;
  createdAt: string;
  sender: { id: string; name: string; avatarUrl?: string };
  attachments: Array<{ id: string; fileId: string; filename: string }>;
}

export interface PaginatedThreadsResponse {
  items: MessageThread[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface PaginatedMessagesResponse {
  items: MessageItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

// ── API Functions ────────────────────────────────────────────────────────────

export async function createThread(input: CreateThreadInput): Promise<MessageThread> {
  const { data } = await getApiClient().post<{ data: MessageThread }>(
    MESSAGES_PATHS.THREADS,
    input,
  );
  return data.data;
}

export async function getThreads(params?: ListThreadsParams): Promise<PaginatedThreadsResponse> {
  const { data } = await getApiClient().get<{ data: PaginatedThreadsResponse }>(
    MESSAGES_PATHS.THREADS,
    { params },
  );
  return data.data;
}

export async function getMessages(
  threadId: string,
  params?: ListMessagesParams,
): Promise<PaginatedMessagesResponse> {
  const { data } = await getApiClient().get<{ data: PaginatedMessagesResponse }>(
    MESSAGES_PATHS.threadMessages(threadId),
    { params },
  );
  return data.data;
}

export async function sendMessage(threadId: string, input: SendMessageInput): Promise<MessageItem> {
  const { data } = await getApiClient().post<{ data: MessageItem }>(
    MESSAGES_PATHS.threadMessages(threadId),
    input,
  );
  return data.data;
}
