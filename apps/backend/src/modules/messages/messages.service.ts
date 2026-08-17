import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MessageContextType,
  NotificationEntityType,
  NotificationType,
  PoStatus,
  Prisma,
  RfqStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification-feed/notification.service';
import { StorageService } from '../storage/storage.service';

import {
  CreateThreadDto,
  ListMessagesQueryDto,
  ListThreadsQueryDto,
  SendMessageDto,
} from './messages.dto';

const CLOSED_RFQ_STATUSES: RfqStatus[] = [RfqStatus.CLOSED, RfqStatus.CANCELLED];
const CLOSED_PO_STATUSES: PoStatus[] = [PoStatus.CLOSED, PoStatus.CANCELLED];

/**
 * Context types whose threads are authorised by *access to the document* (being
 * the buyer company or the vendor on it) rather than by prior thread
 * participation. Participation is only a notification subscription for these —
 * it must never gate reading, because only the users present at creation get
 * seeded, which is how PO conversations ended up invisible to buyer colleagues
 * and vendor reps. Material/warehouse requests stay participant-only until they
 * get a real access model.
 */
const ACCESS_GATED_CONTEXTS: ReadonlySet<MessageContextType> = new Set([
  MessageContextType.RFQ,
  MessageContextType.PURCHASE_ORDER,
  MessageContextType.QUOTE_RESPONSE,
]);

/**
 * Presign window for the sender company logos shown beside in-app messages
 * (FOR-288). Threads are viewed live — the tab re-fetches on a short interval,
 * which re-signs — so a modest TTL is ample and keeps the URLs from lingering.
 */
const MESSAGE_LOGO_URL_TTL_SECONDS = 60 * 60;

/**
 * Prisma select for a message sender: the person plus their company's brand
 * (name + logo key), so the UI can render "{rep} at {company}" with the company
 * logo instead of a bare initial (FOR-288).
 */
const MESSAGE_SENDER_SELECT = {
  id: true,
  name: true,
  email: true,
  company: { select: { legalName: true, tradeName: true, logoUrl: true } },
} satisfies Prisma.UserSelect;

/** A message sender as loaded with {@link MESSAGE_SENDER_SELECT}. */
type SenderWithCompany = {
  id: string;
  name: string;
  email: string;
  company: { legalName: string; tradeName: string | null; logoUrl: string | null } | null;
};

/** Thread loaded with its participants (and each participant's user) — the shape
 * returned by createThread, used for the get-or-create/join paths. */
const THREAD_WITH_PARTICIPANTS_INCLUDE = {
  participants: {
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  },
} satisfies Prisma.MessageThreadInclude;

type ThreadWithParticipants = Prisma.MessageThreadGetPayload<{
  include: typeof THREAD_WITH_PARTICIPANTS_INCLUDE;
}>;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationService,
  ) {}

  async createThread(dto: CreateThreadDto, user: AuthenticatedUser) {
    const contextType = dto.contextType as unknown as MessageContextType;

    // Validate context document exists
    await this.validateContextExists(contextType, dto.contextId);

    // The caller must be a party to the document (its buyer company or its
    // vendor) to open or join its thread — existence alone would let any
    // authenticated user join any conversation by id.
    if (
      ACCESS_GATED_CONTEXTS.has(contextType) &&
      !(await this.canAccessContext(contextType, dto.contextId, user))
    ) {
      throw new ForbiddenException(ERR.messages.noContextAccess);
    }

    // Seed both sides automatically for contexts where they're derivable — a
    // QUOTE_RESPONSE thread gets the RFQ buyer AND that vendor's sales reps, and
    // a PURCHASE_ORDER thread gets the PO's buyer AND the vendor company's users
    // (FOR-288), so the conversation is complete whether the buyer or the vendor
    // opens it first, without the caller having to know the other party's ids.
    const counterpartyIds = await this.resolveThreadCounterparties(contextType, dto.contextId);

    // Only real users can be thread participants. The caller may pass ids that
    // aren't users — notably a PO's "vendor" is a *Company*, not a User — which
    // would otherwise fail the participant insert with a foreign-key error (a
    // 500). Drop unknown ids; the counterparties above seed the real users. The
    // current user is always kept (they exist by definition).
    const participantIds = await this.filterExistingUserIds([
      user.id,
      ...dto.participantIds,
      ...counterpartyIds,
    ]);

    // A context has exactly one thread (unique on contextType + contextId), so
    // this is get-or-create: a second opener — or a buyer who isn't the PO
    // creator — joins the existing thread instead of tripping the unique
    // constraint (which otherwise surfaced as a 500).
    const existing = await this.findThreadByContext(contextType, dto.contextId);
    if (existing) return this.joinThread(existing, participantIds);

    try {
      return await this.prisma.messageThread.create({
        data: {
          contextType,
          contextId: dto.contextId,
          participants: { create: participantIds.map((userId) => ({ userId })) },
        },
        include: THREAD_WITH_PARTICIPANTS_INCLUDE,
      });
    } catch (err) {
      // Lost a create race — another request created the context's thread
      // between our lookup and insert. Join that thread rather than 500-ing.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const raced = await this.findThreadByContext(contextType, dto.contextId);
        if (raced) return this.joinThread(raced, participantIds);
      }
      throw err;
    }
  }

  /** The single thread for a context, or null — keyed on the unique context. */
  private findThreadByContext(contextType: MessageContextType, contextId: string) {
    return this.prisma.messageThread.findUnique({
      where: { contextType_contextId: { contextType, contextId } },
      include: THREAD_WITH_PARTICIPANTS_INCLUDE,
    });
  }

  /** Add any of `participantIds` not already on the thread, then return it. */
  private async joinThread(
    thread: ThreadWithParticipants,
    participantIds: string[],
  ): Promise<ThreadWithParticipants> {
    const known = new Set(thread.participants.map((p) => p.userId));
    const missing = participantIds.filter((id) => !known.has(id));
    if (missing.length === 0) return thread;
    return this.prisma.messageThread.update({
      where: { id: thread.id },
      data: { participants: { create: missing.map((userId) => ({ userId })) } },
      include: THREAD_WITH_PARTICIPANTS_INCLUDE,
    });
  }

  /** Keep only ids that reference an existing user (deduped), preserving none of
   * the non-user ids a caller might pass (e.g. a company id). */
  private async filterExistingUserIds(ids: string[]): Promise<string[]> {
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  async listThreads(query: ListThreadsQueryDto, user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 25, 100);
    const skip = (page - 1) * limit;

    // Document-scoped lookup (the Messages tabs pass both filters): visibility
    // follows access to the document, not prior participation. A viewer who can
    // see the PO/RFQ/quote is joined on first read, so the existing
    // conversation appears instead of an empty "No messages yet" — and being a
    // participant from then on, they are notified of later messages.
    if (query.contextType && query.contextId) {
      const contextType = query.contextType as unknown as MessageContextType;
      const thread = await this.findThreadByContext(contextType, query.contextId);
      if (
        thread &&
        !thread.participants.some((p) => p.userId === user.id) &&
        (await this.canAccessContext(contextType, query.contextId, user))
      ) {
        await this.joinParticipants(thread.id, [user.id]);
      }
    }

    const where: Record<string, unknown> = {
      participants: {
        some: { userId: user.id },
      },
    };

    if (query.contextType) {
      where['contextType'] = query.contextType as unknown as MessageContextType;
    }

    if (query.contextId) {
      where['contextId'] = query.contextId;
    }

    const [threads, total] = await Promise.all([
      this.prisma.messageThread.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: MESSAGE_SENDER_SELECT,
              },
            },
          },
          _count: {
            select: { participants: true },
          },
        },
      }),
      this.prisma.messageThread.count({ where }),
    ]);

    const logoUrls = await this.signLogoUrls(
      threads.map((thread) => thread.messages[0]?.sender.company?.logoUrl),
    );

    const items = threads.map((thread) => ({
      id: thread.id,
      contextType: thread.contextType,
      contextId: thread.contextId,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      participants: thread.participants.map((p) => ({
        id: p.id,
        userId: p.user.id,
        name: p.user.name,
        email: p.user.email,
        joinedAt: p.joinedAt.toISOString(),
      })),
      lastMessage: thread.messages[0]
        ? {
            id: thread.messages[0].id,
            content: thread.messages[0].content,
            sender: this.toSender(thread.messages[0].sender, logoUrls),
            createdAt: thread.messages[0].createdAt.toISOString(),
          }
        : null,
      participantCount: thread._count.participants,
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMessages(threadId: string, query: ListMessagesQueryDto, user: AuthenticatedUser) {
    await this.ensureThreadAccess(threadId, user);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 25, 100);
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { threadId },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          sender: {
            select: MESSAGE_SENDER_SELECT,
          },
          attachments: {
            include: {
              file: {
                select: { id: true, filename: true, mimeType: true, size: true },
              },
            },
          },
        },
      }),
      this.prisma.message.count({ where: { threadId } }),
    ]);

    const logoUrls = await this.signLogoUrls(messages.map((m) => m.sender.company?.logoUrl));

    const items = messages.map((msg) => ({
      id: msg.id,
      threadId: msg.threadId,
      content: msg.content,
      sender: this.toSender(msg.sender, logoUrls),
      attachments: msg.attachments.map((a) => ({
        id: a.id,
        file: a.file,
      })),
      createdAt: msg.createdAt.toISOString(),
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async sendMessage(threadId: string, dto: SendMessageDto, user: AuthenticatedUser) {
    await this.ensureThreadAccess(threadId, user);

    // Get the thread to check context document status
    const thread = await this.prisma.messageThread.findUniqueOrThrow({
      where: { id: threadId },
    });

    await this.validateContextNotClosed(thread.contextType, thread.contextId);

    const message = await this.prisma.message.create({
      data: {
        threadId,
        senderUserId: user.id,
        content: dto.content,
        ...(dto.attachmentIds?.length
          ? {
              attachments: {
                create: dto.attachmentIds.map((fileId) => ({
                  fileId,
                })),
              },
            }
          : {}),
      },
      include: {
        sender: {
          select: MESSAGE_SENDER_SELECT,
        },
        attachments: {
          include: {
            file: {
              select: { id: true, filename: true, mimeType: true, size: true },
            },
          },
        },
      },
    });

    // Touch thread updatedAt
    await this.prisma.messageThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });

    // Notify the other participants in-app (best-effort). Chat is in-app only —
    // per ADR-0011 the thread itself is the surface, so there is no email here.
    await this.notifyThreadParticipants(
      threadId,
      thread,
      message.sender.name,
      message.content,
      user.id,
    );

    const logoUrls = await this.signLogoUrls([message.sender.company?.logoUrl]);

    return {
      id: message.id,
      threadId: message.threadId,
      content: message.content,
      sender: this.toSender(message.sender, logoUrls),
      attachments: message.attachments.map((a) => ({
        id: a.id,
        file: a.file,
      })),
      createdAt: message.createdAt.toISOString(),
    };
  }

  /**
   * Notify every other participant of a new message (best-effort). The
   * notification deep-links to the thread's underlying document so the recipient
   * lands where the conversation lives.
   */
  private async notifyThreadParticipants(
    threadId: string,
    thread: { contextType: MessageContextType; contextId: string },
    senderName: string,
    content: string,
    senderId: string,
  ): Promise<void> {
    try {
      // Repair the participant list before resolving recipients: threads
      // created before counterparty seeding hold only whoever the client passed
      // (often just the sender), so their messages would otherwise notify no
      // one, forever. Idempotent and cheap.
      await this.healThreadParticipants(threadId, thread);

      const participants = await this.prisma.threadParticipant.findMany({
        where: { threadId, userId: { not: senderId } },
        select: { userId: true },
      });
      if (participants.length === 0) return;

      const { entityType, metadata } = await this.resolveNotificationTarget(thread);
      const preview = content.length > 140 ? `${content.slice(0, 140)}…` : content;

      await this.notifications.createForUsers({
        userIds: participants.map((p) => p.userId),
        type: NotificationType.MESSAGE_RECEIVED,
        title: 'New message',
        body: `${senderName}: ${preview}`,
        ...(entityType ? { entityType, entityId: thread.contextId } : {}),
        ...(metadata ? { metadata } : {}),
      });
    } catch {
      // best-effort — a notification failure must not fail the message send
    }
  }

  /**
   * Map a thread's context to a notification deep-link target. QUOTE_RESPONSE
   * also carries `rfqId` so the front end can build /rfqs/:rfqId/quotes/:quoteId.
   * Context types without an app route (material/warehouse requests) get no
   * target — the notification still shows, just without a "go to" link.
   */
  private async resolveNotificationTarget(thread: {
    contextType: MessageContextType;
    contextId: string;
  }): Promise<{ entityType?: NotificationEntityType; metadata?: Record<string, unknown> }> {
    switch (thread.contextType) {
      case MessageContextType.RFQ:
        return { entityType: NotificationEntityType.RFQ };
      case MessageContextType.PURCHASE_ORDER:
        return { entityType: NotificationEntityType.PURCHASE_ORDER };
      case MessageContextType.QUOTE_RESPONSE: {
        const quote = await this.prisma.quoteResponse.findUnique({
          where: { id: thread.contextId },
          select: { rfqId: true },
        });
        return {
          entityType: NotificationEntityType.QUOTE_RESPONSE,
          ...(quote ? { metadata: { rfqId: quote.rfqId } } : {}),
        };
      }
      default:
        return {};
    }
  }

  /**
   * Presign each distinct company logo key once (a message list is often many
   * messages from a handful of companies), returning a key→signed-URL map.
   */
  private async signLogoUrls(keys: Array<string | null | undefined>): Promise<Map<string, string>> {
    const distinct = [...new Set(keys.filter((k): k is string => Boolean(k)))];
    const signed = await Promise.all(
      distinct.map(
        async (key) =>
          [key, await this.storage.getSignedUrl(key, MESSAGE_LOGO_URL_TTL_SECONDS)] as const,
      ),
    );
    return new Map(signed);
  }

  /**
   * Shape a sender for the API: the rep plus their company's display name and a
   * presigned logo URL (resolved from `logoUrls`). Falls back legalName →
   * tradeName, and to `null` when the company has no logo (UI shows an initial).
   */
  private toSender(sender: SenderWithCompany, logoUrls: Map<string, string>) {
    const logoKey = sender.company?.logoUrl ?? null;
    return {
      id: sender.id,
      name: sender.name,
      email: sender.email,
      companyName: sender.company?.legalName ?? sender.company?.tradeName ?? null,
      companyLogoUrl: logoKey ? (logoUrls.get(logoKey) ?? null) : null,
    };
  }

  /**
   * Derive both sides of a conversation so the thread is complete no matter who
   * opens it first (FOR-288), without the caller having to know the other
   * party's user ids. The authenticated caller is always added by createThread.
   * Contexts without a derivable counterparty return nothing.
   */
  private async resolveThreadCounterparties(
    contextType: MessageContextType,
    contextId: string,
  ): Promise<string[]> {
    switch (contextType) {
      case MessageContextType.QUOTE_RESPONSE:
        return this.resolveQuoteCounterparties(contextId);
      case MessageContextType.PURCHASE_ORDER:
        return this.resolvePurchaseOrderCounterparties(contextId);
      default:
        return [];
    }
  }

  /**
   * PO thread sides: the PO's buyer (its creator) and the vendor company's
   * (non-inactive) users. This is what lets a buyer open a PO thread without
   * knowing the vendor's user ids — the buyer PO detail page only has the
   * vendor *company* id, which is not a valid participant.
   */
  private async resolvePurchaseOrderCounterparties(contextId: string): Promise<string[]> {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: contextId },
      select: { createdByUserId: true, vendorId: true },
    });
    if (!po) return [];

    const participants: string[] = [];
    if (po.createdByUserId) participants.push(po.createdByUserId);
    if (po.vendorId) participants.push(...(await this.activeVendorUserIds(po.vendorId)));
    return participants;
  }

  /**
   * QUOTE_RESPONSE thread sides: the RFQ owner (buyer) plus the vendor's chosen
   * sales reps for this RFQ (US 5.05 `RfqVendorContact`), falling back to the
   * vendor company's own (non-inactive) users when no reps were chosen.
   */
  private async resolveQuoteCounterparties(contextId: string): Promise<string[]> {
    const quote = await this.prisma.quoteResponse.findUnique({
      where: { id: contextId },
      select: {
        rfqId: true,
        vendorId: true,
        rfq: { select: { createdByUserId: true } },
      },
    });
    if (!quote) return [];

    const participants: string[] = [];

    // Buyer side: the RFQ owner.
    if (quote.rfq?.createdByUserId) participants.push(quote.rfq.createdByUserId);

    // Vendor side: chosen sales reps, else the vendor company's own users.
    const rfqVendor = await this.prisma.rfqVendor.findUnique({
      where: { rfqId_vendorId: { rfqId: quote.rfqId, vendorId: quote.vendorId } },
      select: { contacts: { select: { userId: true } } },
    });
    const repIds = rfqVendor?.contacts.map((c) => c.userId) ?? [];
    if (repIds.length > 0) {
      participants.push(...repIds);
    } else {
      participants.push(...(await this.activeVendorUserIds(quote.vendorId)));
    }
    return participants;
  }

  /** The vendor-side reps: a vendor company's non-inactive users. */
  private async activeVendorUserIds(vendorCompanyId: string): Promise<string[]> {
    const vendorUsers = await this.prisma.user.findMany({
      where: {
        companyId: vendorCompanyId,
        role: UserRole.VENDOR,
        status: { not: UserStatus.INACTIVE },
      },
      select: { id: true },
    });
    return vendorUsers.map((u) => u.id);
  }

  /**
   * Assert the user may read/write this thread. Participants pass outright.
   * A non-participant passes when they can access the thread's context document
   * (see {@link canAccessContext}) and is joined as a participant on the way
   * through, so the thread shows up in their listings and they are notified of
   * later messages.
   */
  private async ensureThreadAccess(threadId: string, user: AuthenticatedUser): Promise<void> {
    const participant = await this.prisma.threadParticipant.findUnique({
      where: {
        threadId_userId: { threadId, userId: user.id },
      },
    });
    if (participant) return;

    const thread = await this.prisma.messageThread.findUnique({
      where: { id: threadId },
      select: { contextType: true, contextId: true },
    });
    if (!thread || !(await this.canAccessContext(thread.contextType, thread.contextId, user))) {
      throw new ForbiddenException(ERR.messages.noContextAccess);
    }
    await this.joinParticipants(threadId, [user.id]);
  }

  /**
   * Whether the user is a party to a thread's context document: a member of the
   * buyer company, or of the vendor company, on the PO / RFQ / quote. This —
   * not prior participation — is what gates a document conversation: colleagues
   * of the creator and vendor reps must be able to read it even though only the
   * users known at creation time were seeded as participants. Super admins pass
   * unconditionally; context types without an access model return false (their
   * threads stay participant-only).
   */
  private async canAccessContext(
    contextType: MessageContextType,
    contextId: string,
    user: AuthenticatedUser,
  ): Promise<boolean> {
    if (user.role === UserRole.SUPER_ADMIN) return true;
    if (!user.companyId) return false;

    switch (contextType) {
      case MessageContextType.PURCHASE_ORDER: {
        const po = await this.prisma.purchaseOrder.findUnique({
          where: { id: contextId },
          select: { companyId: true, vendorId: true },
        });
        return !!po && (po.companyId === user.companyId || po.vendorId === user.companyId);
      }
      case MessageContextType.RFQ: {
        const rfq = await this.prisma.rfq.findUnique({
          where: { id: contextId },
          select: { companyId: true },
        });
        if (!rfq) return false;
        if (rfq.companyId === user.companyId) return true;
        const rfqVendor = await this.prisma.rfqVendor.findUnique({
          where: { rfqId_vendorId: { rfqId: contextId, vendorId: user.companyId } },
          select: { rfqId: true },
        });
        return rfqVendor !== null;
      }
      case MessageContextType.QUOTE_RESPONSE: {
        const quote = await this.prisma.quoteResponse.findUnique({
          where: { id: contextId },
          select: { vendorId: true, rfq: { select: { companyId: true } } },
        });
        return (
          !!quote && (quote.vendorId === user.companyId || quote.rfq.companyId === user.companyId)
        );
      }
      default:
        return false;
    }
  }

  /** Add users as thread participants, ignoring ones already on the thread. */
  private async joinParticipants(threadId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    await this.prisma.threadParticipant.createMany({
      data: userIds.map((userId) => ({ threadId, userId })),
      skipDuplicates: true,
    });
  }

  /**
   * Re-derive the thread's counterparties and join any that are missing.
   * Threads created before counterparty seeding existed hold only the users the
   * client passed, so without this repair their messages notify no one and stay
   * invisible to the other side.
   */
  private async healThreadParticipants(
    threadId: string,
    thread: { contextType: MessageContextType; contextId: string },
  ): Promise<void> {
    const counterparties = await this.resolveThreadCounterparties(
      thread.contextType,
      thread.contextId,
    );
    if (counterparties.length === 0) return;

    const existing = await this.prisma.threadParticipant.findMany({
      where: { threadId },
      select: { userId: true },
    });
    const known = new Set(existing.map((p) => p.userId));
    const missing = await this.filterExistingUserIds(counterparties.filter((id) => !known.has(id)));
    await this.joinParticipants(threadId, missing);
  }

  private async validateContextExists(
    contextType: MessageContextType,
    contextId: string,
  ): Promise<void> {
    switch (contextType) {
      case MessageContextType.RFQ: {
        const rfq = await this.prisma.rfq.findUnique({ where: { id: contextId } });
        if (!rfq) throw new NotFoundException(ERR.rfqs.notFound);
        break;
      }
      case MessageContextType.PURCHASE_ORDER: {
        const po = await this.prisma.purchaseOrder.findUnique({ where: { id: contextId } });
        if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);
        break;
      }
      case MessageContextType.QUOTE_RESPONSE: {
        const quote = await this.prisma.quoteResponse.findUnique({ where: { id: contextId } });
        if (!quote) throw new NotFoundException(ERR.rfqs.quoteNotFound);
        break;
      }
      // MATERIAL_REQUEST and WAREHOUSE_RELEASE_REQUEST — skip validation for now
      // as those models may not yet exist
      default:
        break;
    }
  }

  private async validateContextNotClosed(
    contextType: MessageContextType,
    contextId: string,
  ): Promise<void> {
    switch (contextType) {
      case MessageContextType.RFQ: {
        const rfq = await this.prisma.rfq.findUnique({
          where: { id: contextId },
          select: { status: true },
        });
        if (rfq && CLOSED_RFQ_STATUSES.includes(rfq.status)) {
          throw new BadRequestException(ERR.messages.documentClosed);
        }
        break;
      }
      case MessageContextType.PURCHASE_ORDER: {
        const po = await this.prisma.purchaseOrder.findUnique({
          where: { id: contextId },
          select: { status: true },
        });
        if (po && CLOSED_PO_STATUSES.includes(po.status)) {
          throw new BadRequestException(ERR.messages.documentClosed);
        }
        break;
      }
      case MessageContextType.QUOTE_RESPONSE: {
        const quote = await this.prisma.quoteResponse.findUnique({
          where: { id: contextId },
          select: { rfq: { select: { status: true } } },
        });
        if (quote && CLOSED_RFQ_STATUSES.includes(quote.rfq.status)) {
          throw new BadRequestException(ERR.messages.documentClosed);
        }
        break;
      }
      default:
        break;
    }
  }
}
