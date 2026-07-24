import { Injectable, Logger } from '@nestjs/common';
import { Notification, Prisma, UserStatus } from '@prisma/client';

import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

import { NotificationEventsService } from './notification-events.service';
import { ListNotificationsQueryDto, NotificationFilter } from './notification.dto';
import {
  CreateNotificationInput,
  NotificationContent,
  NotificationDto,
} from './notification.types';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: NotificationEventsService,
  ) {}

  /**
   * Create one notification per recipient user and push each over SSE. This is
   * called alongside the transactional-email sends, so — like those — it is
   * best-effort: any failure is swallowed and logged, never propagated, so a
   * notification hiccup can't roll back or break the domain action that
   * triggered it.
   */
  async createForUsers(input: CreateNotificationInput): Promise<void> {
    const userIds = [...new Set(input.userIds)].filter((id) => Boolean(id));
    if (userIds.length === 0) return;

    try {
      // Create individually (not createMany) so we get each row back — including
      // its id and timestamp — to push over SSE. Recipient counts per event are
      // small (a handful of buyer/vendor users), so this is cheap.
      const created = await Promise.all(
        userIds.map((userId) =>
          this.prisma.notification.create({
            data: {
              userId,
              type: input.type,
              title: input.title,
              body: input.body ?? null,
              entityType: input.entityType ?? null,
              entityId: input.entityId ?? null,
              metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
            },
          }),
        ),
      );

      for (const notification of created) {
        this.events.emit(notification.userId, this.toDto(notification));
      }
    } catch (error) {
      this.logger.warn(
        `Failed to create in-app notifications (type=${input.type}): ${String(error)}`,
      );
    }
  }

  /**
   * Resolve the given email addresses to ACTIVE platform users and notify them.
   * Addresses with no active user (e.g. an unactivated vendor reachable only by
   * email, or a plain contact address) are simply skipped — they have no in-app
   * inbox — which matches ADR-0011's "email only for unactivated vendors".
   */
  async createForEmails(emails: string[], content: NotificationContent): Promise<void> {
    const unique = [...new Set(emails.filter((email) => Boolean(email)))];
    if (unique.length === 0) return;

    try {
      const users = await this.prisma.user.findMany({
        where: { email: { in: unique }, status: UserStatus.ACTIVE },
        select: { id: true },
      });
      await this.createForUsers({ ...content, userIds: users.map((u) => u.id) });
    } catch (error) {
      this.logger.warn(
        `Failed to resolve notification recipients by email (type=${content.type}): ${String(error)}`,
      );
    }
  }

  /** The current user's notifications, newest first, with the unread count. */
  async list(user: AuthenticatedUser, query: ListNotificationsQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = Math.min(query.limit && query.limit > 0 ? query.limit : 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      ...(query.filter === NotificationFilter.UNREAD ? { readAt: null } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);

    return {
      items: notifications.map((n) => this.toDto(n)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    };
  }

  /** Cheap unread count for the header badge. */
  async unreadCount(user: AuthenticatedUser): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
    return { count };
  }

  /** Mark one of the current user's notifications read (no-op if already read). */
  async markRead(user: AuthenticatedUser, id: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  /** Mark every unread notification of the current user read. */
  async markAllRead(user: AuthenticatedUser): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  private toDto(notification: Notification): NotificationDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      entityType: notification.entityType,
      entityId: notification.entityId,
      metadata: notification.metadata ?? null,
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
