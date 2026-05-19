import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { MessagesController } from '../messages.controller';
import { MessagesService } from '../messages.service';

const mockPrisma = {
  messageThread: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  message: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  threadParticipant: {
    findUnique: jest.fn(),
  },
  rfq: {
    findUnique: jest.fn(),
  },
  purchaseOrder: {
    findUnique: jest.fn(),
  },
};

const currentUser = {
  id: 'user-1',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
  email: 'user1@test.com',
};

describe('MessagesService', () => {
  let service: MessagesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MessagesService(mockPrisma as never);
  });

  // ── createThread ──────────────────────────────────────────────────────────

  describe('createThread', () => {
    it('should create thread with participants', async () => {
      const dto = {
        contextType: 'RFQ',
        contextId: 'rfq-1',
        participantIds: ['user-2', 'user-3'],
      };

      mockPrisma.rfq.findUnique.mockResolvedValue({ id: 'rfq-1' });
      mockPrisma.messageThread.create.mockResolvedValue({
        id: 'thread-1',
        contextType: 'RFQ',
        contextId: 'rfq-1',
        participants: [
          {
            id: 'p-1',
            userId: 'user-1',
            user: { id: 'user-1', name: 'A', email: 'a@t.com' },
            joinedAt: new Date(),
          },
          {
            id: 'p-2',
            userId: 'user-2',
            user: { id: 'user-2', name: 'B', email: 'b@t.com' },
            joinedAt: new Date(),
          },
          {
            id: 'p-3',
            userId: 'user-3',
            user: { id: 'user-3', name: 'C', email: 'c@t.com' },
            joinedAt: new Date(),
          },
        ],
      });

      const result = await service.createThread(dto as never, currentUser);

      expect(result.id).toBe('thread-1');
      expect(mockPrisma.messageThread.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contextType: 'RFQ',
            contextId: 'rfq-1',
          }),
        }),
      );
    });

    it('should create thread with PURCHASE_ORDER context', async () => {
      const dto = {
        contextType: 'PURCHASE_ORDER',
        contextId: 'po-1',
        participantIds: ['user-2'],
      };

      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1' });
      mockPrisma.messageThread.create.mockResolvedValue({
        id: 'thread-2',
        contextType: 'PURCHASE_ORDER',
        contextId: 'po-1',
        participants: [],
      });

      const result = await service.createThread(dto as never, currentUser);
      expect(result.id).toBe('thread-2');
      expect(mockPrisma.purchaseOrder.findUnique).toHaveBeenCalledWith({ where: { id: 'po-1' } });
    });

    it('should throw NotFoundException when RFQ context does not exist', async () => {
      const dto = {
        contextType: 'RFQ',
        contextId: 'rfq-missing',
        participantIds: ['user-2'],
      };

      mockPrisma.rfq.findUnique.mockResolvedValue(null);

      await expect(service.createThread(dto as never, currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when PO context does not exist', async () => {
      const dto = {
        contextType: 'PURCHASE_ORDER',
        contextId: 'po-missing',
        participantIds: ['user-2'],
      };

      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(service.createThread(dto as never, currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should allow creating thread with unknown context type (no validation)', async () => {
      const dto = {
        contextType: 'MATERIAL_REQUEST',
        contextId: 'mr-1',
        participantIds: ['user-2'],
      };

      mockPrisma.messageThread.create.mockResolvedValue({
        id: 'thread-3',
        contextType: 'MATERIAL_REQUEST',
        contextId: 'mr-1',
        participants: [],
      });

      const result = await service.createThread(dto as never, currentUser);
      expect(result.id).toBe('thread-3');
    });

    it('should include current user as participant', async () => {
      const dto = {
        contextType: 'RFQ',
        contextId: 'rfq-1',
        participantIds: ['user-2'],
      };

      mockPrisma.rfq.findUnique.mockResolvedValue({ id: 'rfq-1' });
      mockPrisma.messageThread.create.mockResolvedValue({
        id: 'thread-1',
        contextType: 'RFQ',
        contextId: 'rfq-1',
        participants: [],
      });

      await service.createThread(dto as never, currentUser);

      const createCall = mockPrisma.messageThread.create.mock.calls[0][0];
      const participantCreateData = createCall.data.participants.create;
      const participantUserIds = participantCreateData.map((p: { userId: string }) => p.userId);

      expect(participantUserIds).toContain('user-1');
      expect(participantUserIds).toContain('user-2');
    });
  });

  // ── listThreads ───────────────────────────────────────────────────────────

  describe('listThreads', () => {
    it('should return threads where user is participant (paginated)', async () => {
      const now = new Date();
      const threads = [
        {
          id: 'thread-1',
          contextType: 'RFQ',
          contextId: 'rfq-1',
          createdAt: now,
          updatedAt: now,
          participants: [
            { id: 'p-1', user: { id: 'user-1', name: 'A', email: 'a@t.com' }, joinedAt: now },
          ],
          messages: [],
          _count: { participants: 1 },
        },
      ];

      mockPrisma.messageThread.findMany.mockResolvedValue(threads);
      mockPrisma.messageThread.count.mockResolvedValue(1);

      const result = await service.listThreads({ page: 1, limit: 10 } as never, currentUser);

      expect(result.items).toHaveLength(1);
      expect(result.meta).toEqual(expect.objectContaining({ page: 1, limit: 10, total: 1 }));
      expect(mockPrisma.messageThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            participants: { some: { userId: 'user-1' } },
          }),
          skip: 0,
          take: 10,
        }),
      );
    });

    it('should filter threads by contextType', async () => {
      mockPrisma.messageThread.findMany.mockResolvedValue([]);
      mockPrisma.messageThread.count.mockResolvedValue(0);

      await service.listThreads({ contextType: 'RFQ' } as never, currentUser);

      const where = mockPrisma.messageThread.findMany.mock.calls[0][0].where;
      expect(where.contextType).toBe('RFQ');
    });

    it('should filter threads by contextId', async () => {
      mockPrisma.messageThread.findMany.mockResolvedValue([]);
      mockPrisma.messageThread.count.mockResolvedValue(0);

      await service.listThreads({ contextId: 'rfq-1' } as never, currentUser);

      const where = mockPrisma.messageThread.findMany.mock.calls[0][0].where;
      expect(where.contextId).toBe('rfq-1');
    });

    it('should map lastMessage when thread has messages', async () => {
      const now = new Date();
      const threads = [
        {
          id: 'thread-1',
          contextType: 'RFQ',
          contextId: 'rfq-1',
          createdAt: now,
          updatedAt: now,
          participants: [],
          messages: [
            {
              id: 'msg-1',
              content: 'Hello',
              sender: { id: 'user-1', name: 'A', email: 'a@t.com' },
              createdAt: now,
            },
          ],
          _count: { participants: 1 },
        },
      ];

      mockPrisma.messageThread.findMany.mockResolvedValue(threads);
      mockPrisma.messageThread.count.mockResolvedValue(1);

      const result = await service.listThreads({} as never, currentUser);
      expect(result.items[0].lastMessage).not.toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(result.items[0].lastMessage!.content).toBe('Hello');
    });
  });

  // ── getMessages ───────────────────────────────────────────────────────────

  describe('getMessages', () => {
    it('should throw ForbiddenException if user is not participant', async () => {
      mockPrisma.threadParticipant.findUnique.mockResolvedValue(null);

      await expect(
        service.getMessages('thread-1', { page: 1, limit: 25 } as never, currentUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return paginated messages', async () => {
      const now = new Date();
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });

      const messages = [
        {
          id: 'msg-1',
          threadId: 'thread-1',
          content: 'Hello',
          sender: { id: 'user-1', name: 'A', email: 'a@t.com' },
          attachments: [],
          createdAt: now,
        },
      ];

      mockPrisma.message.findMany.mockResolvedValue(messages);
      mockPrisma.message.count.mockResolvedValue(1);

      const result = await service.getMessages(
        'thread-1',
        { page: 1, limit: 25 } as never,
        currentUser,
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].content).toBe('Hello');
      expect(result.meta.total).toBe(1);
    });

    it('should return messages with attachments', async () => {
      const now = new Date();
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });

      const messages = [
        {
          id: 'msg-1',
          threadId: 'thread-1',
          content: 'With file',
          sender: { id: 'user-1', name: 'A', email: 'a@t.com' },
          attachments: [
            {
              id: 'att-1',
              file: { id: 'file-1', filename: 'doc.pdf', mimeType: 'application/pdf', size: 1024 },
            },
          ],
          createdAt: now,
        },
      ];

      mockPrisma.message.findMany.mockResolvedValue(messages);
      mockPrisma.message.count.mockResolvedValue(1);

      const result = await service.getMessages(
        'thread-1',
        { page: 1, limit: 25 } as never,
        currentUser,
      );

      expect(result.items[0].attachments).toHaveLength(1);
      expect(result.items[0].attachments[0].file.filename).toBe('doc.pdf');
    });
  });

  // ── sendMessage ───────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('should create message with content', async () => {
      const now = new Date();
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.messageThread.findUniqueOrThrow.mockResolvedValue({
        id: 'thread-1',
        contextType: 'RFQ',
        contextId: 'rfq-1',
      });
      mockPrisma.rfq.findUnique.mockResolvedValue({ id: 'rfq-1', status: 'OPEN' });
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-1',
        threadId: 'thread-1',
        content: 'Test message',
        sender: { id: 'user-1', name: 'A', email: 'a@t.com' },
        attachments: [],
        createdAt: now,
      });
      mockPrisma.messageThread.update.mockResolvedValue({});

      const result = await service.sendMessage(
        'thread-1',
        { content: 'Test message' } as never,
        currentUser,
      );

      expect(result.content).toBe('Test message');
      expect(mockPrisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            threadId: 'thread-1',
            senderUserId: 'user-1',
            content: 'Test message',
          }),
        }),
      );
    });

    it('should throw BadRequestException if document is closed (RFQ CLOSED)', async () => {
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.messageThread.findUniqueOrThrow.mockResolvedValue({
        id: 'thread-1',
        contextType: 'RFQ',
        contextId: 'rfq-1',
      });
      mockPrisma.rfq.findUnique.mockResolvedValue({ id: 'rfq-1', status: 'CLOSED' });

      await expect(
        service.sendMessage('thread-1', { content: 'Too late' } as never, currentUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if user is not participant', async () => {
      mockPrisma.threadParticipant.findUnique.mockResolvedValue(null);

      await expect(
        service.sendMessage('thread-1', { content: 'Hello' } as never, currentUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create message with attachments', async () => {
      const now = new Date();
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.messageThread.findUniqueOrThrow.mockResolvedValue({
        id: 'thread-1',
        contextType: 'RFQ',
        contextId: 'rfq-1',
      });
      mockPrisma.rfq.findUnique.mockResolvedValue({ id: 'rfq-1', status: 'OPEN' });
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-2',
        threadId: 'thread-1',
        content: 'With file',
        sender: { id: 'user-1', name: 'A', email: 'a@t.com' },
        attachments: [
          {
            id: 'att-1',
            file: { id: 'file-1', filename: 'doc.pdf', mimeType: 'application/pdf', size: 1024 },
          },
        ],
        createdAt: now,
      });
      mockPrisma.messageThread.update.mockResolvedValue({});

      const result = await service.sendMessage(
        'thread-1',
        { content: 'With file', attachmentIds: ['file-1'] } as never,
        currentUser,
      );

      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].file.filename).toBe('doc.pdf');
    });

    it('should throw BadRequestException for closed PURCHASE_ORDER context', async () => {
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.messageThread.findUniqueOrThrow.mockResolvedValue({
        id: 'thread-1',
        contextType: 'PURCHASE_ORDER',
        contextId: 'po-1',
      });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', status: 'CLOSED' });

      await expect(
        service.sendMessage('thread-1', { content: 'Too late' } as never, currentUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for cancelled PURCHASE_ORDER context', async () => {
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.messageThread.findUniqueOrThrow.mockResolvedValue({
        id: 'thread-1',
        contextType: 'PURCHASE_ORDER',
        contextId: 'po-1',
      });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', status: 'CANCELLED' });

      await expect(
        service.sendMessage('thread-1', { content: 'Too late' } as never, currentUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow sendMessage for cancelled RFQ context', async () => {
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.messageThread.findUniqueOrThrow.mockResolvedValue({
        id: 'thread-1',
        contextType: 'RFQ',
        contextId: 'rfq-1',
      });
      mockPrisma.rfq.findUnique.mockResolvedValue({ id: 'rfq-1', status: 'CANCELLED' });

      await expect(
        service.sendMessage('thread-1', { content: 'Msg' } as never, currentUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow sendMessage for open PO context', async () => {
      const now = new Date();
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.messageThread.findUniqueOrThrow.mockResolvedValue({
        id: 'thread-1',
        contextType: 'PURCHASE_ORDER',
        contextId: 'po-1',
      });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', status: 'DRAFT' });
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-3',
        threadId: 'thread-1',
        content: 'OK',
        sender: { id: 'user-1', name: 'A', email: 'a@t.com' },
        attachments: [],
        createdAt: now,
      });
      mockPrisma.messageThread.update.mockResolvedValue({});

      const result = await service.sendMessage('thread-1', { content: 'OK' } as never, currentUser);
      expect(result.content).toBe('OK');
    });

    it('should allow sendMessage for unknown context type (default)', async () => {
      const now = new Date();
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.messageThread.findUniqueOrThrow.mockResolvedValue({
        id: 'thread-1',
        contextType: 'MATERIAL_REQUEST',
        contextId: 'mr-1',
      });
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-4',
        threadId: 'thread-1',
        content: 'Hello',
        sender: { id: 'user-1', name: 'A', email: 'a@t.com' },
        attachments: [],
        createdAt: now,
      });
      mockPrisma.messageThread.update.mockResolvedValue({});

      const result = await service.sendMessage(
        'thread-1',
        { content: 'Hello' } as never,
        currentUser,
      );
      expect(result.content).toBe('Hello');
    });
  });
});

// ── MessagesController ─────────────────────────────────────────────────────

describe('MessagesController', () => {
  let controller: MessagesController;
  const mockService = {
    createThread: jest.fn(),
    listThreads: jest.fn(),
    getMessages: jest.fn(),
    sendMessage: jest.fn(),
  };

  const user = {
    id: 'user-1',
    role: 'COMPANY_ADMIN',
    companyId: 'comp-1',
    email: 'user@test.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MessagesController(mockService as never);
  });

  it('createThread delegates to service', async () => {
    const dto = { contextType: 'RFQ', contextId: 'rfq-1', participantIds: [] };
    mockService.createThread.mockResolvedValue({ id: 'thread-1' });
    const result = await controller.createThread(dto as never, user as never);
    expect(result).toEqual({ id: 'thread-1' });
    expect(mockService.createThread).toHaveBeenCalledWith(dto, user);
  });

  it('listThreads delegates to service', async () => {
    const query = { page: 1, limit: 10 };
    mockService.listThreads.mockResolvedValue({ items: [], meta: {} });
    const result = await controller.listThreads(query as never, user as never);
    expect(result).toEqual({ items: [], meta: {} });
  });

  it('getMessages delegates to service', async () => {
    mockService.getMessages.mockResolvedValue({ items: [], meta: {} });
    const result = await controller.getMessages('thread-1', {} as never, user as never);
    expect(result).toEqual({ items: [], meta: {} });
  });

  it('sendMessage delegates to service', async () => {
    mockService.sendMessage.mockResolvedValue({ id: 'msg-1' });
    const result = await controller.sendMessage(
      'thread-1',
      { content: 'Hi' } as never,
      user as never,
    );
    expect(result).toEqual({ id: 'msg-1' });
  });
});
