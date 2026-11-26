import { Injectable } from '@nestjs/common';

import { NotificationDto } from './notification.types';

/**
 * A chat thread received a new message. Carries only identifiers — the client
 * refetches the thread through the normal, access-checked messages API, so the
 * stream never leaks message content to a connection.
 */
export interface MessageActivityEvent {
  threadId: string;
  contextType: string;
  contextId: string;
}

/** One named SSE frame: `event: <event>` + `data: <JSON>`. */
export type StreamFrame =
  | { event: 'notification'; data: NotificationDto }
  | { event: 'message'; data: MessageActivityEvent };

type StreamListener = (frame: StreamFrame) => void;

/**
 * In-process pub/sub that pushes events to the SSE connections a user
 * currently holds open: freshly-created notifications, and chat activity so an
 * open thread updates instantly. This is a single-instance bus: it only reaches
 * clients connected to the same Node process, which is sufficient for the
 * current single-container deployment. If the backend is ever scaled
 * horizontally this needs a cross-instance transport (Redis pub/sub or Postgres
 * LISTEN/NOTIFY); until then the front-end's poll fallback covers the gap for
 * any client that happens to be on another instance.
 */
@Injectable()
export class NotificationEventsService {
  private readonly listeners = new Map<string, Set<StreamListener>>();

  /**
   * Register a listener for a user's stream frames. Returns an unsubscribe
   * function that must be called when the SSE connection closes.
   */
  subscribe(userId: string, listener: StreamListener): () => void {
    let set = this.listeners.get(userId);
    if (!set) {
      set = new Set();
      this.listeners.set(userId, set);
    }
    set.add(listener);

    return () => {
      const current = this.listeners.get(userId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(userId);
      }
    };
  }

  /** Push a notification to every open connection the user holds. */
  emit(userId: string, notification: NotificationDto): void {
    this.push(userId, { event: 'notification', data: notification });
  }

  /** Tell each user's open connections that a thread they belong to changed. */
  emitMessageActivity(userIds: string[], activity: MessageActivityEvent): void {
    for (const userId of new Set(userIds)) {
      this.push(userId, { event: 'message', data: activity });
    }
  }

  private push(userId: string, frame: StreamFrame): void {
    const set = this.listeners.get(userId);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(frame);
      } catch {
        // A single broken connection must not stop delivery to the others.
      }
    }
  }
}
