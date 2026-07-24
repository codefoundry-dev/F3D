import { Injectable } from '@nestjs/common';

import { NotificationDto } from './notification.types';

type NotificationListener = (notification: NotificationDto) => void;

/**
 * In-process pub/sub that pushes freshly-created notifications to the SSE
 * connections a user currently holds open. This is a single-instance bus: it
 * only reaches clients connected to the same Node process, which is sufficient
 * for the current single-container deployment. If the backend is ever scaled
 * horizontally this needs a cross-instance transport (Redis pub/sub or Postgres
 * LISTEN/NOTIFY); until then the front-end's focus/slow-poll fallback covers the
 * gap for any client that happens to be on another instance.
 */
@Injectable()
export class NotificationEventsService {
  private readonly listeners = new Map<string, Set<NotificationListener>>();

  /**
   * Register a listener for a user's notifications. Returns an unsubscribe
   * function that must be called when the SSE connection closes.
   */
  subscribe(userId: string, listener: NotificationListener): () => void {
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
    const set = this.listeners.get(userId);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(notification);
      } catch {
        // A single broken connection must not stop delivery to the others.
      }
    }
  }
}
