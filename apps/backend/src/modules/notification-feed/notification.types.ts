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
}

/** Content of a notification, shared by every recipient of a single event. */
export interface NotificationContent {
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: NotificationEntityType;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/** A notification plus its explicit recipient user ids. */
export interface CreateNotificationInput extends NotificationContent {
  userIds: string[];
}
