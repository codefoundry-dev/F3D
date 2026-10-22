import { NotificationEntityType, NotificationType } from '@prisma/client';

/** The serialized notification shape returned by the API and pushed over SSE. */
export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  metadata: unknown;
  readAt: string | null;
  createdAt: string;
  /**
   * Who the notification came from, already formatted (FOR-366) —
   * `"{full name} · {company}"`, the company alone, or "Forethread" for system
   * events. Null for rows created before the sender was recorded; their body
   * text still names whoever acted.
   */
  sender: string | null;
}

/**
 * Who raised a notification (FOR-366). Pass `userId` for a signed-in actor —
 * the service resolves their name and company — or explicit `name` /
 * `companyName` for a guest acting through a tokenised link. Explicit values win
 * over the resolved ones. `SYSTEM_SENDER` marks platform-raised events.
 */
export interface NotificationSender {
  userId?: string | null;
  name?: string | null;
  companyName?: string | null;
}

/** Sender of events the platform raises on its own (reminders, routing fallbacks). */
export const SYSTEM_SENDER: NotificationSender = {};

/** Content of a notification, shared by every recipient of a single event. */
export interface NotificationContent {
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: NotificationEntityType;
  entityId?: string;
  metadata?: Record<string, unknown>;
  /** Required so every notification type records who it came from. */
  sender: NotificationSender;
}

/** A notification plus its explicit recipient user ids. */
export interface CreateNotificationInput extends NotificationContent {
  userIds: string[];
}
