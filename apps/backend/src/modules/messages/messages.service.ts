import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageContextType, PoStatus, RfqStatus } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

import {
  CreateThreadDto,
  ListMessagesQueryDto,
  ListThreadsQueryDto,
  SendMessageDto,
} from './messages.dto';

const CLOSED_RFQ_STATUSES: RfqStatus[] = [RfqStatus.CLOSED, RfqStatus.CANCELLED];
const CLOSED_PO_STATUSES: PoStatus[] = [PoStatus.CLOSED, PoStatus.CANCELLED];

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async createThread(dto: CreateThreadDto, user: AuthenticatedUser) {
    // Validate context document exists
    await this.validateContextExists(
      dto.contextType as unknown as MessageContextType,
      dto.contextId,
    );

    // Ensure the current user is included in participants
    const allParticipantIds = Array.from(new Set([user.id, ...dto.participantIds]));

    const thread = await this.prisma.messageThread.create({
      data: {
        contextType: dto.contextType as unknown as MessageContextType,
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
                select: { id: true, name: true, email: true },
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
            sender: thread.messages[0].sender,
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
            select: { id: true, name: true, email: true },
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

    const items = messages.map((msg) => ({
      id: msg.id,
      threadId: msg.threadId,
      content: msg.content,
      sender: msg.sender,
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
          select: { id: true, name: true, email: true },
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

    return {
      id: message.id,
      threadId: message.threadId,
      content: message.content,
      sender: message.sender,
      attachments: message.attachments.map((a) => ({
        id: a.id,
        file: a.file,
      })),
      createdAt: message.createdAt.toISOString(),
    };
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
      default:
        break;
    }
  }
}
