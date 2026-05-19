import { AuditController } from './audit.controller';
import { AuditService, AuditLogQueryDto } from './audit.service';

describe('AuditController', () => {
  let controller: AuditController;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(() => {
    auditService = {
      listLogs: jest.fn(),
      log: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    controller = new AuditController(auditService);
  });

  describe('listLogs', () => {
    it('should delegate to AuditService.listLogs with the query', async () => {
      const query: AuditLogQueryDto = { page: 1, limit: 25 };
      const expected = {
        items: [{ id: 'log-1', action: 'USER_CREATED' }],
        meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
      };
      auditService.listLogs.mockResolvedValue(expected as never);

      const result = await controller.listLogs(query);

      expect(auditService.listLogs).toHaveBeenCalledWith(query);
      expect(result).toEqual(expected);
    });

    it('should pass through filter parameters', async () => {
      const query: AuditLogQueryDto = {
        page: 2,
        limit: 10,
        action: 'USER_CREATED' as never,
        targetType: 'User',
        performedById: 'user-1',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      };
      auditService.listLogs.mockResolvedValue({
        items: [],
        meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
      });

      await controller.listLogs(query);

      expect(auditService.listLogs).toHaveBeenCalledWith(query);
    });
  });
});
