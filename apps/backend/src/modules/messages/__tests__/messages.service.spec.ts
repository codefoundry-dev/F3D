import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { MessagesController } from '../messages.controller';
import { MessagesService } from '../messages.service';

const mockPrisma = {
  messageThread: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
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
    findMany: jest.fn(),
    createMany: jest.fn(),
  },
  rfq: {
    findUnique: jest.fn(),
  },
  purchaseOrder: {
    findUnique: jest.fn(),
  },
  quoteResponse: {
    findUnique: jest.fn(),
  },
  rfqVendor: {
    findUnique: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
};

const mockStorage = {
  getSignedUrl: jest.fn(),
};

const mockNotifications = {
  createForUsers: jest.fn().mockResolvedValue(undefined),
  createForEmails: jest.fn().mockResolvedValue(undefined),
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
    mockStorage.getSignedUrl.mockResolvedValue('https://signed.example/logo.png');
    mockPrisma.threadParticipant.findMany.mockResolvedValue([]);
    // No existing thread for a context by default → createThread takes the
    // create path. Tests exercising get-or-create override this.
    mockPrisma.messageThread.findUnique.mockResolvedValue(null);
    // filterExistingUserIds looks users up by id — by default treat every
    // requested id as a real user (echo the id.in list). Vendor-user lookups
    // (by companyId) return none unless a test sets them.
    mockPrisma.user.findMany.mockImplementation((args?: { where?: { id?: { in?: string[] } } }) =>
      Promise.resolve((args?.where?.id?.in ?? []).map((id) => ({ id }))),
    );
    service = new MessagesService(
      mockPrisma as never,
      mockStorage as never,
      mockNotifications as never,
    );
  });

  // ── createThread ──────────────────────────────────────────────────────────

  describe('createThread', () => {
    it('should create thread with participants', async () => {
      const dto = {
        contextType: 'RFQ',
        contextId: 'rfq-1',
        participantIds: ['user-2', 'user-3'],
      };

      mockPrisma.rfq.findUnique.mockResolvedValue({ id: 'rfq-1', companyId: 'comp-1' });
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

      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', companyId: 'comp-1' });
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

    it('seeds a QUOTE_RESPONSE thread with the RFQ buyer AND the vendor’s sales reps (FOR-288)', async () => {
      const dto = {
        contextType: 'QUOTE_RESPONSE',
        contextId: 'quote-1',
        participantIds: [],
      };

      mockPrisma.quoteResponse.findUnique.mockResolvedValue({
        rfqId: 'rfq-1',
        vendorId: 'vend-1',
        rfq: { createdByUserId: 'buyer-1', companyId: 'comp-1' },
      });
      mockPrisma.rfqVendor.findUnique.mockResolvedValue({
        contacts: [{ userId: 'rep-1' }, { userId: 'rep-2' }],
      });
      mockPrisma.messageThread.create.mockResolvedValue({
        id: 'thread-q',
        contextType: 'QUOTE_RESPONSE',
        contextId: 'quote-1',
        participants: [],
      });

      await service.createThread(dto as never, currentUser);

      const createCall = mockPrisma.messageThread.create.mock.calls[0][0];
      const ids = createCall.data.participants.create.map((p: { userId: string }) => p.userId);
      // Both sides seeded regardless of initiator: caller + RFQ buyer + vendor reps.
      expect(ids).toEqual(expect.arrayContaining(['user-1', 'buyer-1', 'rep-1', 'rep-2']));
      expect(mockPrisma.rfqVendor.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { rfqId_vendorId: { rfqId: 'rfq-1', vendorId: 'vend-1' } },
        }),
      );
      // Reps were found — no fallback lookup of the vendor company's users.
      // (user.findMany is still called by the participant-existence filter.)
      expect(mockPrisma.user.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'vend-1' }) }),
      );
    });

    it('falls back to the vendor company’s users when no reps were chosen (still seeds the buyer)', async () => {
      const dto = {
        contextType: 'QUOTE_RESPONSE',
        contextId: 'quote-1',
        participantIds: [],
      };

      mockPrisma.quoteResponse.findUnique.mockResolvedValue({
        rfqId: 'rfq-1',
        vendorId: 'vend-1',
        rfq: { createdByUserId: 'buyer-1', companyId: 'comp-1' },
      });
      mockPrisma.rfqVendor.findUnique.mockResolvedValue({ contacts: [] });
      // Vendor-company lookup returns one user; the id-existence filter still
      // echoes the ids it is asked about.
      mockPrisma.user.findMany.mockImplementation(
        (args?: { where?: { companyId?: string; id?: { in?: string[] } } }) =>
          Promise.resolve(
            args?.where?.companyId
              ? [{ id: 'vu-1' }]
              : (args?.where?.id?.in ?? []).map((id) => ({ id })),
          ),
      );
      mockPrisma.messageThread.create.mockResolvedValue({
        id: 'thread-q',
        contextType: 'QUOTE_RESPONSE',
        contextId: 'quote-1',
        participants: [],
      });

      await service.createThread(dto as never, currentUser);

      const ids = mockPrisma.messageThread.create.mock.calls[0][0].data.participants.create.map(
        (p: { userId: string }) => p.userId,
      );
      expect(ids).toEqual(expect.arrayContaining(['user-1', 'buyer-1', 'vu-1']));
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'vend-1', role: UserRole.VENDOR }),
        }),
      );
    });

    it('throws NotFoundException when the QUOTE_RESPONSE context is missing', async () => {
      const dto = {
        contextType: 'QUOTE_RESPONSE',
        contextId: 'quote-missing',
        participantIds: [],
      };

      mockPrisma.quoteResponse.findUnique.mockResolvedValue(null);

      await expect(service.createThread(dto as never, currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should include current user as participant', async () => {
      const dto = {
        contextType: 'RFQ',
        contextId: 'rfq-1',
        participantIds: ['user-2'],
      };

      mockPrisma.rfq.findUnique.mockResolvedValue({ id: 'rfq-1', companyId: 'comp-1' });
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

    it('seeds a PURCHASE_ORDER thread with the PO buyer AND the vendor company’s users', async () => {
      const dto = { contextType: 'PURCHASE_ORDER', contextId: 'po-1', participantIds: [] };

      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        companyId: 'comp-1',
        createdByUserId: 'buyer-1',
        vendorId: 'vend-1',
      });
      mockPrisma.user.findMany.mockImplementation(
        (args?: { where?: { companyId?: string; id?: { in?: string[] } } }) =>
          Promise.resolve(
            args?.where?.companyId
              ? [{ id: 'vu-1' }]
              : (args?.where?.id?.in ?? []).map((id) => ({ id })),
          ),
      );
      mockPrisma.messageThread.create.mockResolvedValue({ id: 'thread-po', participants: [] });

      await service.createThread(dto as never, currentUser);

      const ids = mockPrisma.messageThread.create.mock.calls[0][0].data.participants.create.map(
        (p: { userId: string }) => p.userId,
      );
      // Buyer opens the thread → caller + PO creator + vendor company users.
      expect(ids).toEqual(expect.arrayContaining(['user-1', 'buyer-1', 'vu-1']));
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'vend-1', role: UserRole.VENDOR }),
        }),
      );
    });

    it('drops participant ids that are not users (e.g. a vendor *company* id) rather than 500-ing', async () => {
      const dto = {
        contextType: 'PURCHASE_ORDER',
        contextId: 'po-1',
        // 'company-1' is a Company id wrongly supplied as a participant — the
        // regression that produced a foreign-key 500. It must be filtered out.
        participantIds: ['company-1'],
      };

      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', companyId: 'comp-1' });
      mockPrisma.user.findMany.mockImplementation(
        (args?: { where?: { id?: { in?: string[] } } }) => {
          const requested = args?.where?.id?.in ?? [];
          // Only real users exist; the company id is not among them.
          return Promise.resolve(
            requested.filter((id) => id !== 'company-1').map((id) => ({ id })),
          );
        },
      );
      mockPrisma.messageThread.create.mockResolvedValue({ id: 'thread-po', participants: [] });

      await service.createThread(dto as never, currentUser);

      const ids = mockPrisma.messageThread.create.mock.calls[0][0].data.participants.create.map(
        (p: { userId: string }) => p.userId,
      );
      expect(ids).toContain('user-1');
      expect(ids).not.toContain('company-1');
    });

    it('joins the existing context thread (adding the caller) instead of creating a duplicate', async () => {
      const dto = { contextType: 'RFQ', contextId: 'rfq-1', participantIds: [] };

      mockPrisma.rfq.findUnique.mockResolvedValue({ id: 'rfq-1', companyId: 'comp-1' });
      const existing = {
        id: 'thread-x',
        contextType: 'RFQ',
        contextId: 'rfq-1',
        participants: [
          {
            id: 'p-9',
            userId: 'someone-else',
            user: { id: 'someone-else', name: 'X', email: 'x@t.com' },
            joinedAt: new Date(),
          },
        ],
      };
      mockPrisma.messageThread.findUnique.mockResolvedValue(existing);
      mockPrisma.messageThread.update.mockResolvedValue(existing);

      const result = await service.createThread(dto as never, currentUser);

      expect(result.id).toBe('thread-x');
      expect(mockPrisma.messageThread.create).not.toHaveBeenCalled();
      // The caller (user-1) wasn't a participant yet, so they are added.
      expect(mockPrisma.messageThread.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'thread-x' },
          data: { participants: { create: [{ userId: 'user-1' }] } },
        }),
      );
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

    it('enriches the sender with company name + a presigned logo URL (FOR-288)', async () => {
      const now = new Date();
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.message.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          threadId: 'thread-1',
          content: 'Hello',
          sender: {
            id: 'user-1',
            name: 'Jane',
            email: 'jane@acme.com',
            company: { legalName: 'Acme Ltd', tradeName: null, logoUrl: 'logos/acme.png' },
          },
          attachments: [],
          createdAt: now,
        },
      ]);
      mockPrisma.message.count.mockResolvedValue(1);

      const result = await service.getMessages(
        'thread-1',
        { page: 1, limit: 25 } as never,
        currentUser,
      );

      expect(result.items[0].sender).toEqual(
        expect.objectContaining({
          id: 'user-1',
          name: 'Jane',
          companyName: 'Acme Ltd',
          companyLogoUrl: 'https://signed.example/logo.png',
        }),
      );
      expect(mockStorage.getSignedUrl).toHaveBeenCalledWith('logos/acme.png', expect.any(Number));
    });

    it('leaves company fields null and skips signing when the sender company has no logo', async () => {
      const now = new Date();
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.message.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          threadId: 'thread-1',
          content: 'Hello',
          sender: {
            id: 'user-1',
            name: 'Jane',
            email: 'jane@acme.com',
            company: { legalName: 'Acme Ltd', tradeName: null, logoUrl: null },
          },
          attachments: [],
          createdAt: now,
        },
      ]);
      mockPrisma.message.count.mockResolvedValue(1);

      const result = await service.getMessages(
        'thread-1',
        { page: 1, limit: 25 } as never,
        currentUser,
      );

      expect(result.items[0].sender.companyName).toBe('Acme Ltd');
      expect(result.items[0].sender.companyLogoUrl).toBeNull();
      expect(mockStorage.getSignedUrl).not.toHaveBeenCalled();
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

    it('notifies the other participants in-app, excluding the sender', async () => {
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
        content: 'Ping',
        sender: { id: 'user-1', name: 'Alice', email: 'a@t.com' },
        attachments: [],
        createdAt: now,
      });
      mockPrisma.messageThread.update.mockResolvedValue({});
      // Sender is excluded by the service's `userId: { not: sender }` filter, so
      // the mock returns only the other participant.
      mockPrisma.threadParticipant.findMany.mockResolvedValue([{ userId: 'user-2' }]);

      await service.sendMessage('thread-1', { content: 'Ping' } as never, currentUser);

      expect(mockPrisma.threadParticipant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { threadId: 'thread-1', userId: { not: 'user-1' } },
        }),
      );
      expect(mockNotifications.createForUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          userIds: ['user-2'],
          type: 'MESSAGE_RECEIVED',
          entityType: 'RFQ',
          entityId: 'rfq-1',
          body: expect.stringContaining('Alice'),
        }),
      );
    });

    it('targets the purchase order for a PURCHASE_ORDER thread', async () => {
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.messageThread.findUniqueOrThrow.mockResolvedValue({
        id: 'thread-1',
        contextType: 'PURCHASE_ORDER',
        contextId: 'po-1',
      });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', status: 'SENT' });
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-1',
        threadId: 'thread-1',
        content: 'Hi',
        sender: { id: 'user-1', name: 'Alice', email: 'a@t.com' },
        attachments: [],
        createdAt: new Date(),
      });
      mockPrisma.messageThread.update.mockResolvedValue({});
      mockPrisma.threadParticipant.findMany.mockResolvedValue([{ userId: 'user-2' }]);

      await service.sendMessage('thread-1', { content: 'Hi' } as never, currentUser);

      expect(mockNotifications.createForUsers).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'PURCHASE_ORDER', entityId: 'po-1' }),
      );
    });

    it('carries rfqId metadata for a QUOTE_RESPONSE thread', async () => {
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.messageThread.findUniqueOrThrow.mockResolvedValue({
        id: 'thread-1',
        contextType: 'QUOTE_RESPONSE',
        contextId: 'quote-1',
      });
      // One quote superset serves the status guard, the participant heal, and
      // the notification-target resolution.
      mockPrisma.quoteResponse.findUnique.mockResolvedValue({
        rfqId: 'rfq-42',
        vendorId: 'vend-1',
        rfq: { status: 'OPEN', createdByUserId: 'buyer-1' },
      });
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(null);
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-1',
        threadId: 'thread-1',
        content: 'Hi',
        sender: { id: 'user-1', name: 'Alice', email: 'a@t.com' },
        attachments: [],
        createdAt: new Date(),
      });
      mockPrisma.messageThread.update.mockResolvedValue({});
      mockPrisma.threadParticipant.findMany.mockResolvedValue([{ userId: 'user-2' }]);

      await service.sendMessage('thread-1', { content: 'Hi' } as never, currentUser);

      expect(mockNotifications.createForUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'QUOTE_RESPONSE',
          entityId: 'quote-1',
          metadata: { rfqId: 'rfq-42' },
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

    it('should allow an attachment-only message with empty content', async () => {
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.messageThread.findUniqueOrThrow.mockResolvedValue({
        id: 'thread-1',
        contextType: 'RFQ',
        contextId: 'rfq-1',
      });
      mockPrisma.rfq.findUnique.mockResolvedValue({ id: 'rfq-1', status: 'OPEN' });
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-3',
        threadId: 'thread-1',
        content: '',
        sender: { id: 'user-1', name: 'Alice', email: 'a@t.com' },
        attachments: [
          {
            id: 'att-1',
            file: { id: 'file-1', filename: 'photo.png', mimeType: 'image/png', size: 2048 },
          },
        ],
        createdAt: new Date(),
      });
      mockPrisma.messageThread.update.mockResolvedValue({});
      mockPrisma.threadParticipant.findMany.mockResolvedValue([{ userId: 'user-2' }]);

      const result = await service.sendMessage(
        'thread-1',
        { content: '', attachmentIds: ['file-1'] } as never,
        currentUser,
      );

      expect(result.attachments).toHaveLength(1);
      // The notification must not render a dangling "Alice: " for empty content.
      expect(mockNotifications.createForUsers).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'Alice sent an attachment' }),
      );
    });

    it('should throw BadRequestException when both content and attachments are empty', async () => {
      await expect(
        service.sendMessage('thread-1', { content: '   ' } as never, currentUser),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.message.create).not.toHaveBeenCalled();
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

    it('enriches the sender with company branding on send (FOR-288)', async () => {
      const now = new Date();
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.messageThread.findUniqueOrThrow.mockResolvedValue({
        id: 'thread-1',
        contextType: 'PURCHASE_ORDER',
        contextId: 'po-1',
      });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', status: 'SENT' });
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-1',
        threadId: 'thread-1',
        content: 'Hi',
        sender: {
          id: 'user-1',
          name: 'Jane',
          email: 'jane@acme.com',
          company: { legalName: 'Acme Ltd', tradeName: null, logoUrl: 'logos/acme.png' },
        },
        attachments: [],
        createdAt: now,
      });
      mockPrisma.messageThread.update.mockResolvedValue({});

      const result = await service.sendMessage('thread-1', { content: 'Hi' } as never, currentUser);

      expect(result.sender.companyName).toBe('Acme Ltd');
      expect(result.sender.companyLogoUrl).toBe('https://signed.example/logo.png');
    });

    it('should throw BadRequestException for a QUOTE_RESPONSE whose RFQ is closed', async () => {
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.messageThread.findUniqueOrThrow.mockResolvedValue({
        id: 'thread-1',
        contextType: 'QUOTE_RESPONSE',
        contextId: 'quote-1',
      });
      mockPrisma.quoteResponse.findUnique.mockResolvedValue({ rfq: { status: 'CLOSED' } });

      await expect(
        service.sendMessage('thread-1', { content: 'Too late' } as never, currentUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow sendMessage for an open QUOTE_RESPONSE (RFQ open)', async () => {
      const now = new Date();
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.messageThread.findUniqueOrThrow.mockResolvedValue({
        id: 'thread-1',
        contextType: 'QUOTE_RESPONSE',
        contextId: 'quote-1',
      });
      mockPrisma.quoteResponse.findUnique.mockResolvedValue({ rfq: { status: 'OPEN' } });
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-q',
        threadId: 'thread-1',
        content: 'Quote question',
        sender: { id: 'user-1', name: 'A', email: 'a@t.com' },
        attachments: [],
        createdAt: now,
      });
      mockPrisma.messageThread.update.mockResolvedValue({});

      const result = await service.sendMessage(
        'thread-1',
        { content: 'Quote question' } as never,
        currentUser,
      );
      expect(result.content).toBe('Quote question');
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

    it('repairs an orphaned PO thread on send: missing counterparties are joined and notified', async () => {
      mockPrisma.threadParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrisma.messageThread.findUniqueOrThrow.mockResolvedValue({
        id: 'thread-1',
        contextType: 'PURCHASE_ORDER',
        contextId: 'po-1',
      });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'SENT',
        companyId: 'comp-1',
        createdByUserId: 'user-1',
        vendorId: 'vend-1',
      });
      // Vendor company has one user; the id-existence filter echoes ids.
      mockPrisma.user.findMany.mockImplementation(
        (args?: { where?: { companyId?: string; id?: { in?: string[] } } }) =>
          Promise.resolve(
            args?.where?.companyId
              ? [{ id: 'vu-1' }]
              : (args?.where?.id?.in ?? []).map((id) => ({ id })),
          ),
      );
      // The thread holds only the sender (created before counterparty seeding);
      // the post-heal recipient query sees the newly joined vendor user.
      mockPrisma.threadParticipant.findMany.mockImplementation(
        (args?: { where?: { userId?: unknown } }) =>
          Promise.resolve(args?.where?.userId ? [{ userId: 'vu-1' }] : [{ userId: 'user-1' }]),
      );
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-1',
        threadId: 'thread-1',
        content: 'Anyone there?',
        sender: { id: 'user-1', name: 'Alice', email: 'a@t.com' },
        attachments: [],
        createdAt: new Date(),
      });
      mockPrisma.messageThread.update.mockResolvedValue({});

      await service.sendMessage('thread-1', { content: 'Anyone there?' } as never, currentUser);

      // The vendor user was missing and gets joined; the sender is not re-added.
      expect(mockPrisma.threadParticipant.createMany).toHaveBeenCalledWith({
        data: [{ threadId: 'thread-1', userId: 'vu-1' }],
        skipDuplicates: true,
      });
      expect(mockNotifications.createForUsers).toHaveBeenCalledWith(
        expect.objectContaining({ userIds: ['vu-1'], type: 'MESSAGE_RECEIVED' }),
      );
    });
  });

  // ── context access (visibility follows the document, not participation) ────

  describe('context access', () => {
    const poThread = {
      id: 'thread-po',
      contextType: 'PURCHASE_ORDER',
      contextId: 'po-1',
      participants: [
        {
          id: 'p-9',
          userId: 'someone-else',
          user: { id: 'someone-else', name: 'X', email: 'x@t.com' },
          joinedAt: new Date(),
        },
      ],
    };

    it('listThreads joins a non-participant buyer colleague on document-scoped lookup', async () => {
      mockPrisma.messageThread.findUnique.mockResolvedValue(poThread);
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        companyId: 'comp-1',
        vendorId: 'vend-1',
      });
      mockPrisma.messageThread.findMany.mockResolvedValue([]);
      mockPrisma.messageThread.count.mockResolvedValue(0);

      await service.listThreads(
        { contextType: 'PURCHASE_ORDER', contextId: 'po-1' } as never,
        currentUser,
      );

      expect(mockPrisma.threadParticipant.createMany).toHaveBeenCalledWith({
        data: [{ threadId: 'thread-po', userId: 'user-1' }],
        skipDuplicates: true,
      });
    });

    it('listThreads joins a vendor-company user on document-scoped lookup', async () => {
      const vendorUser = {
        id: 'vu-1',
        role: UserRole.VENDOR,
        companyId: 'vend-1',
        email: 'v@t.com',
      };
      mockPrisma.messageThread.findUnique.mockResolvedValue(poThread);
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        companyId: 'comp-1',
        vendorId: 'vend-1',
      });
      mockPrisma.messageThread.findMany.mockResolvedValue([]);
      mockPrisma.messageThread.count.mockResolvedValue(0);

      await service.listThreads(
        { contextType: 'PURCHASE_ORDER', contextId: 'po-1' } as never,
        vendorUser as never,
      );

      expect(mockPrisma.threadParticipant.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: [{ threadId: 'thread-po', userId: 'vu-1' }] }),
      );
    });

    it('listThreads does NOT join a user whose company is not a party to the PO', async () => {
      const outsider = {
        id: 'user-9',
        role: UserRole.COMPANY_ADMIN,
        companyId: 'other-co',
        email: 'o@t.com',
      };
      mockPrisma.messageThread.findUnique.mockResolvedValue(poThread);
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        companyId: 'comp-1',
        vendorId: 'vend-1',
      });
      mockPrisma.messageThread.findMany.mockResolvedValue([]);
      mockPrisma.messageThread.count.mockResolvedValue(0);

      await service.listThreads(
        { contextType: 'PURCHASE_ORDER', contextId: 'po-1' } as never,
        outsider as never,
      );

      expect(mockPrisma.threadParticipant.createMany).not.toHaveBeenCalled();
    });

    it('listThreads skips the access check for an existing participant', async () => {
      mockPrisma.messageThread.findUnique.mockResolvedValue({
        ...poThread,
        participants: [
          {
            id: 'p-1',
            userId: 'user-1',
            user: { id: 'user-1', name: 'A', email: 'a@t.com' },
            joinedAt: new Date(),
          },
        ],
      });
      mockPrisma.messageThread.findMany.mockResolvedValue([]);
      mockPrisma.messageThread.count.mockResolvedValue(0);

      await service.listThreads(
        { contextType: 'PURCHASE_ORDER', contextId: 'po-1' } as never,
        currentUser,
      );

      expect(mockPrisma.threadParticipant.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.purchaseOrder.findUnique).not.toHaveBeenCalled();
    });

    it('getMessages joins a non-participant with document access instead of 403-ing', async () => {
      mockPrisma.threadParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.messageThread.findUnique.mockResolvedValue({
        contextType: 'PURCHASE_ORDER',
        contextId: 'po-1',
      });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        companyId: 'comp-1',
        vendorId: null,
      });
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.message.count.mockResolvedValue(0);

      const result = await service.getMessages(
        'thread-1',
        { page: 1, limit: 25 } as never,
        currentUser,
      );

      expect(result.items).toEqual([]);
      expect(mockPrisma.threadParticipant.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: [{ threadId: 'thread-1', userId: 'user-1' }] }),
      );
    });

    it('getMessages still 403s a non-participant without document access', async () => {
      mockPrisma.threadParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.messageThread.findUnique.mockResolvedValue({
        contextType: 'PURCHASE_ORDER',
        contextId: 'po-1',
      });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        companyId: 'other-co',
        vendorId: 'someone',
      });

      await expect(service.getMessages('thread-1', {} as never, currentUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('keeps MATERIAL_REQUEST threads participant-only', async () => {
      mockPrisma.threadParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.messageThread.findUnique.mockResolvedValue({
        contextType: 'MATERIAL_REQUEST',
        contextId: 'mr-1',
      });

      await expect(service.getMessages('thread-1', {} as never, currentUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lets a super admin read any thread', async () => {
      const superAdmin = {
        id: 'sa-1',
        role: UserRole.SUPER_ADMIN,
        companyId: null,
        email: 'sa@t.com',
      };
      mockPrisma.threadParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.messageThread.findUnique.mockResolvedValue({
        contextType: 'PURCHASE_ORDER',
        contextId: 'po-1',
      });
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.message.count.mockResolvedValue(0);

      const result = await service.getMessages('thread-1', {} as never, superAdmin as never);
      expect(result.items).toEqual([]);
    });

    it('grants RFQ thread access to a vendor on the RFQ (RfqVendor row)', async () => {
      const vendorUser = {
        id: 'vu-1',
        role: UserRole.VENDOR,
        companyId: 'vend-1',
        email: 'v@t.com',
      };
      mockPrisma.threadParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.messageThread.findUnique.mockResolvedValue({
        contextType: 'RFQ',
        contextId: 'rfq-1',
      });
      mockPrisma.rfq.findUnique.mockResolvedValue({ companyId: 'comp-1' });
      mockPrisma.rfqVendor.findUnique.mockResolvedValue({ rfqId: 'rfq-1' });
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.message.count.mockResolvedValue(0);

      const result = await service.getMessages('thread-1', {} as never, vendorUser as never);

      expect(result.items).toEqual([]);
      expect(mockPrisma.rfqVendor.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { rfqId_vendorId: { rfqId: 'rfq-1', vendorId: 'vend-1' } },
        }),
      );
    });

    it('denies RFQ thread access to a vendor not on the RFQ', async () => {
      const vendorUser = {
        id: 'vu-1',
        role: UserRole.VENDOR,
        companyId: 'vend-2',
        email: 'v@t.com',
      };
      mockPrisma.threadParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.messageThread.findUnique.mockResolvedValue({
        contextType: 'RFQ',
        contextId: 'rfq-1',
      });
      mockPrisma.rfq.findUnique.mockResolvedValue({ companyId: 'comp-1' });
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(null);

      await expect(
        service.getMessages('thread-1', {} as never, vendorUser as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('grants QUOTE_RESPONSE thread access to the quote vendor', async () => {
      const vendorUser = {
        id: 'vu-1',
        role: UserRole.VENDOR,
        companyId: 'vend-1',
        email: 'v@t.com',
      };
      mockPrisma.threadParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.messageThread.findUnique.mockResolvedValue({
        contextType: 'QUOTE_RESPONSE',
        contextId: 'quote-1',
      });
      mockPrisma.quoteResponse.findUnique.mockResolvedValue({
        vendorId: 'vend-1',
        rfq: { companyId: 'comp-1' },
      });
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.message.count.mockResolvedValue(0);

      const result = await service.getMessages('thread-1', {} as never, vendorUser as never);
      expect(result.items).toEqual([]);
    });

    it('createThread 403s a caller whose company is not a party to the PO', async () => {
      const outsider = {
        id: 'user-9',
        role: UserRole.COMPANY_ADMIN,
        companyId: 'other-co',
        email: 'o@t.com',
      };
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        companyId: 'comp-1',
        vendorId: 'vend-1',
      });

      await expect(
        service.createThread(
          { contextType: 'PURCHASE_ORDER', contextId: 'po-1', participantIds: [] } as never,
          outsider as never,
        ),
      ).rejects.toThrow(ForbiddenException);
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
