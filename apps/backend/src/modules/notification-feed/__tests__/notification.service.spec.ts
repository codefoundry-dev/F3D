import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { NotificationFilter } from '../notification.dto';
import { NotificationService } from '../notification.service';

const user: AuthenticatedUser = {
  id: 'user-1',
  role: 'COMPANY_ADMIN',
  companyId: 'comp-1',
  email: 'u1@test.com',
} as AuthenticatedUser;

const mockPrisma = {
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
};

const mockEvents = {
  emit: jest.fn(),
  subscribe: jest.fn(),
};

const row = (over: Record<string, unknown> = {}) => ({
  id: 'n-1',
  userId: 'user-1',
  type: 'MESSAGE_RECEIVED',
  title: 'New message',
  body: 'hello',
  entityType: 'RFQ',
  entityId: 'rfq-1',
  metadata: null,
  readAt: null,
  createdAt: new Date('2026-07-24T00:00:00.000Z'),
  ...over,
});

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService(mockPrisma as never, mockEvents as never);
    mockPrisma.notification.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve(row(data)),
    );
  });

  describe('createForUsers', () => {
    it('creates one row per distinct user and emits each', async () => {
      await service.createForUsers({
        userIds: ['user-1', 'user-1', 'user-2'],
        type: 'MESSAGE_RECEIVED' as never,
        title: 'New message',
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2);
      expect(mockEvents.emit).toHaveBeenCalledTimes(2);
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ id: 'n-1', createdAt: expect.any(String), readAt: null }),
      );
    });

    it('is a no-op with no recipients', async () => {
      await service.createForUsers({ userIds: [], type: 'PO_ISSUED' as never, title: 'x' });
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('swallows persistence errors (best-effort)', async () => {
      mockPrisma.notification.create.mockRejectedValueOnce(new Error('db down'));
      await expect(
        service.createForUsers({ userIds: ['user-1'], type: 'PO_ISSUED' as never, title: 'x' }),
      ).resolves.toBeUndefined();
      expect(mockEvents.emit).not.toHaveBeenCalled();
    });

    it('persists optional fields (entity + metadata)', async () => {
      await service.createForUsers({
        userIds: ['user-2'],
        type: 'MESSAGE_RECEIVED' as never,
        title: 'New message',
        body: 'hi',
        entityType: 'QUOTE_RESPONSE' as never,
        entityId: 'q-1',
        metadata: { rfqId: 'rfq-9' },
      });
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'QUOTE_RESPONSE',
            entityId: 'q-1',
            metadata: { rfqId: 'rfq-9' },
          }),
        }),
      );
    });
  });

  describe('createForEmails', () => {
    it('resolves active users by email then notifies them', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);
      await service.createForEmails(['a@t.com', 'a@t.com', 'b@t.com'], {
        type: 'RFQ_RECEIVED' as never,
        title: 'New RFQ received',
      });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2);
    });

    it('is a no-op when no emails are given', async () => {
      await service.createForEmails([], { type: 'RFQ_RECEIVED' as never, title: 'x' });
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });

    it('creates nothing when no email matches an active user', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      await service.createForEmails(['ghost@t.com'], { type: 'RFQ_RECEIVED' as never, title: 'x' });
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('swallows lookup errors', async () => {
      mockPrisma.user.findMany.mockRejectedValueOnce(new Error('db down'));
      await expect(
        service.createForEmails(['a@t.com'], { type: 'RFQ_RECEIVED' as never, title: 'x' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('returns items with pagination meta and unread count', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([row(), row({ id: 'n-2' })]);
      mockPrisma.notification.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

      const result = await service.list(user, { page: 1, limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.meta).toMatchObject({ page: 1, limit: 20, total: 2, unreadCount: 1 });
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' }, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('filters to unread when requested', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await service.list(user, { filter: NotificationFilter.UNREAD });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', readAt: null } }),
      );
    });

    it('clamps invalid paging and caps the limit', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await service.list(user, { page: 0, limit: 5000 });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 100 }),
      );
    });

    it('serializes metadata and read state', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([
        row({ metadata: { rfqId: 'r-1' }, readAt: new Date('2026-07-24T01:00:00.000Z') }),
      ]);
      mockPrisma.notification.count.mockResolvedValue(0);

      const result = await service.list(user, {});
      expect(result.items[0]).toMatchObject({
        metadata: { rfqId: 'r-1' },
        readAt: '2026-07-24T01:00:00.000Z',
      });
    });
  });

  describe('unreadCount', () => {
    it('counts unread notifications for the user', async () => {
      mockPrisma.notification.count.mockResolvedValue(3);
      await expect(service.unreadCount(user)).resolves.toEqual({ count: 3 });
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
      });
    });
  });

  describe('markRead / markAllRead', () => {
    it('marks a single notification read, scoped to the owner', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });
      await expect(service.markRead(user, 'n-1')).resolves.toEqual({ updated: 1 });
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'n-1', userId: 'user-1', readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });

    it('marks all unread read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 4 });
      await expect(service.markAllRead(user)).resolves.toEqual({ updated: 4 });
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });
});
