import { formatSenderLabel, SenderParts } from '@forethread/shared-types';
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
  NotificationSender,
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
      const sender = await this.resolveSender(input.sender);
      const metadata: Record<string, unknown> = { ...(input.metadata ?? {}), sender };

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
              metadata: metadata as Prisma.InputJsonValue,
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

  /**
   * Snapshot the sender's name and company onto the row (FOR-366), so the feed
   * keeps showing who acted even after a rename or a deactivation. Explicit
   * values (a guest's typed name) win over the ones resolved from `userId`.
   */
  private async resolveSender(sender: NotificationSender): Promise<SenderParts> {
    let name = sender.name ?? null;
    let companyName = sender.companyName ?? null;
    if (sender.userId && (!name || !companyName)) {
      const user = await this.prisma.user.findUnique({
        where: { id: sender.userId },
        select: { name: true, company: { select: { legalName: true, tradeName: true } } },
      });
      name ??= user?.name ?? null;
      companyName ??= user?.company?.legalName ?? user?.company?.tradeName ?? null;
    }
    return { name, companyName };
  }

  /** The stored sender, or undefined for rows written before FOR-366 recorded one. */
  private readSender(metadata: Prisma.JsonValue | null): SenderParts | undefined {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
    const sender = (metadata as Record<string, unknown>)['sender'];
    if (!sender || typeof sender !== 'object' || Array.isArray(sender)) return undefined;
    const { name, companyName } = sender as Record<string, unknown>;
    return {
      name: typeof name === 'string' ? name : null,
      companyName: typeof companyName === 'string' ? companyName : null,
    };
  }

  private toDto(notification: Notification): NotificationDto {
    const sender = this.readSender(notification.metadata);
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
      // Formatted at read time so every row — whatever emitted it — shows the
      // sender the same way.
      sender: sender ? formatSenderLabel(sender) : null,
    };
  }
}
