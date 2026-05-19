import { AuditService, AuditLogQueryDto } from './audit.service';

const AuditAction = {
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  COMPANY_CREATED: 'COMPANY_CREATED',
} as const;

describe('AuditService', () => {
  let service: AuditService;
  let prisma: {
    auditLog: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    service = new AuditService(prisma as never);
  });

  describe('log', () => {
    it('should create an audit log record', async () => {
      prisma.auditLog.create.mockResolvedValue({});

      await service.log({
        action: AuditAction.USER_CREATED as never,
        performedById: 'user-1',
        targetType: 'User',
        targetId: 'user-2',
        targetLabel: 'John Doe',
        metadata: { role: 'Admin' },
        ipAddress: '127.0.0.1',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: AuditAction.USER_CREATED,
          performedById: 'user-1',
          targetType: 'User',
          targetId: 'user-2',
          targetLabel: 'John Doe',
          metadata: { role: 'Admin' },
          ipAddress: '127.0.0.1',
        },
      });
    });

    it('should use Prisma.JsonNull when metadata is undefined', async () => {
      prisma.auditLog.create.mockResolvedValue({});

      await service.log({
        action: AuditAction.USER_CREATED as never,
        performedById: 'user-1',
        targetType: 'User',
        targetId: 'user-2',
      });

      const callData = prisma.auditLog.create.mock.calls[0][0].data;
      // When metadata is undefined, the service uses Prisma.JsonNull
      expect(callData.metadata).toBeDefined();
      expect(callData.targetLabel).toBeUndefined();
    });
  });

  describe('listLogs', () => {
    const mockItems = [
      {
        id: 'log-1',
        action: 'USER_CREATED',
        performedBy: { id: 'u1', name: 'Admin', email: 'a@b.com' },
      },
    ];

    it('should return paginated results with default page and limit', async () => {
      prisma.auditLog.findMany.mockResolvedValue(mockItems);
      prisma.auditLog.count.mockResolvedValue(1);

      const query: AuditLogQueryDto = {};
      const result = await service.listLogs(query);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 25,
          orderBy: { createdAt: 'desc' },
          include: { performedBy: { select: { id: true, name: true, email: true } } },
        }),
      );
      expect(result.meta).toEqual({ page: 1, limit: 25, total: 1, totalPages: 1 });
      expect(result.items).toEqual(mockItems);
    });

    it('should respect page and limit parameters', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(50);

      const result = await service.listLogs({ page: 3, limit: 10 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.meta).toEqual({ page: 3, limit: 10, total: 50, totalPages: 5 });
    });

    it('should cap limit at 100', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.listLogs({ limit: 500 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    });

    it('should filter by action', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.listLogs({ action: AuditAction.USER_CREATED as never });

      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.action).toBe(AuditAction.USER_CREATED);
    });

    it('should filter by targetType', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.listLogs({ targetType: 'Company' });

      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.targetType).toBe('Company');
    });

    it('should filter by performedById', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.listLogs({ performedById: 'user-1' });

      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.performedById).toBe('user-1');
    });

    it('should filter by date range (dateFrom only)', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.listLogs({ dateFrom: '2026-01-01' });

      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.createdAt).toEqual({ gte: new Date('2026-01-01') });
    });

    it('should filter by date range (dateTo only)', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.listLogs({ dateTo: '2026-12-31' });

      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.createdAt).toEqual({ lte: new Date('2026-12-31') });
    });

    it('should filter by full date range', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.listLogs({ dateFrom: '2026-01-01', dateTo: '2026-06-30' });

      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.createdAt).toEqual({
        gte: new Date('2026-01-01'),
        lte: new Date('2026-06-30'),
      });
    });

    it('should combine multiple filters', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.listLogs({
        action: AuditAction.COMPANY_CREATED as never,
        targetType: 'Company',
        performedById: 'user-1',
        dateFrom: '2026-01-01',
      });

      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.action).toBe(AuditAction.COMPANY_CREATED);
      expect(where.targetType).toBe('Company');
      expect(where.performedById).toBe('user-1');
      expect(where.createdAt).toEqual({ gte: new Date('2026-01-01') });
    });
  });
});
