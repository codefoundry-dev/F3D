import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  const mockHealthCheckService = {
    check: jest.fn(),
  };
  const mockPrismaHealth = {} as any;
  const mockPrisma = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new HealthController(mockHealthCheckService as any, mockPrismaHealth, mockPrisma);
  });

  describe('liveness', () => {
    it('returns status ok', () => {
      const result = controller.liveness();
      expect(result.status).toBe('ok');
    });

    it('returns an ISO timestamp', () => {
      const result = controller.liveness();
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });

  describe('readiness', () => {
    it('delegates to HealthCheckService', () => {
      const expected = { status: 'ok', details: {} };
      mockHealthCheckService.check.mockReturnValue(expected);

      const result = controller.readiness();
      expect(mockHealthCheckService.check).toHaveBeenCalled();
      expect(result).toBe(expected);
    });
  });
});
