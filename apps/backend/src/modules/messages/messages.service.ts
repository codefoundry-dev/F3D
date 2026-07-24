import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MessageContextType,
  PoStatus,
  Prisma,
  RfqStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
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

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async createThread(dto: CreateThreadDto, user: AuthenticatedUser) {
    const contextType = dto.contextType as unknown as MessageContextType;

    // Validate context document exists
    await this.validateContextExists(contextType, dto.contextId);

    // Seed both sides automatically for contexts where they're derivable — a
    // QUOTE_RESPONSE thread gets the RFQ buyer AND that vendor's sales reps
    // (FOR-288), so the conversation is complete whether the buyer or the vendor
    // opens it first, without the caller having to know the other party's ids.
    const counterpartyIds = await this.resolveThreadCounterparties(contextType, dto.contextId);

    // Ensure the current user is included in participants
    const allParticipantIds = Array.from(
      new Set([user.id, ...dto.participantIds, ...counterpartyIds]),
    );

    const thread = await this.prisma.messageThread.create({
      data: {
        contextType,
        contextId: dto.contextId,
        participants: {
          create: allParticipantIds.map((userId) => ({
            userId,
          })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    return thread;
  }

  async listThreads(query: ListThreadsQueryDto, user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 25, 100);
    const skip = (page - 1) * limit;

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
    await this.validateParticipant(threadId, user.id);

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
    await this.validateParticipant(threadId, user.id);

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
   * Both sides of a QUOTE_RESPONSE conversation, so the thread is complete no
   * matter who opens it first (FOR-288): the RFQ owner (buyer) plus the vendor's
   * chosen sales reps for this RFQ (US 5.05 `RfqVendorContact`), falling back to
   * the vendor company's own (non-inactive) users when no reps were chosen. The
   * authenticated caller is always added by createThread, so a buyer-initiated
   * thread still gets the vendor and a vendor-initiated one still gets the
   * buyer. Other contexts derive nothing — the caller supplies participants.
   */
  private async resolveThreadCounterparties(
    contextType: MessageContextType,
    contextId: string,
  ): Promise<string[]> {
    if (contextType !== MessageContextType.QUOTE_RESPONSE) return [];

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
      const vendorUsers = await this.prisma.user.findMany({
        where: {
          companyId: quote.vendorId,
          role: UserRole.VENDOR,
          status: { not: UserStatus.INACTIVE },
        },
        select: { id: true },
      });
      participants.push(...vendorUsers.map((u) => u.id));
    }
    return participants;
  }

  private async validateParticipant(threadId: string, userId: string): Promise<void> {
    const participant = await this.prisma.threadParticipant.findUnique({
      where: {
        threadId_userId: { threadId, userId },
      },
    });

    if (!participant) {
      throw new ForbiddenException(ERR.messages.notParticipant);
    }
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
