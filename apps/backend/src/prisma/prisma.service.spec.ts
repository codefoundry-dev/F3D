// Mock PrismaClient before importing PrismaService
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);

jest.mock('@prisma/client', () => {
  class MockPrismaClient {
    $connect = mockConnect;
    $disconnect = mockDisconnect;
    constructor(_opts?: unknown) {
      // capture options if needed
    }
  }
  return { PrismaClient: MockPrismaClient };
});

import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PrismaService();
  });

  describe('constructor', () => {
    it('creates an instance of PrismaService', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(PrismaService);
    });
  });

  describe('onModuleInit', () => {
    it('calls $connect', async () => {
      await service.onModuleInit();
      expect(mockConnect).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('calls $disconnect', async () => {
      await service.onModuleDestroy();
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});
