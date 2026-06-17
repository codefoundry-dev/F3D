import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';

import { InventoryController } from '../inventory.controller';
import { InventoryService } from '../inventory.service';

const mockService = {
  getBalances: jest.fn(),
  listMovements: jest.fn(),
};

const mockUser = {
  id: 'po-1',
  email: 'po@test.com',
  role: UserRole.PROCUREMENT_OFFICER,
  companyId: 'comp-1',
};

describe('InventoryController', () => {
  let controller: InventoryController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [{ provide: InventoryService, useValue: mockService }],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
  });

  describe('getBalances', () => {
    it('delegates to the service with the query and user', async () => {
      const expected = { items: [] };
      mockService.getBalances.mockResolvedValue(expected);

      const query = { projectId: 'project-1' };
      const result = await controller.getBalances(query, mockUser);

      expect(result).toBe(expected);
      expect(mockService.getBalances).toHaveBeenCalledWith(mockUser, query);
    });
  });

  describe('listMovements', () => {
    it('delegates to the service with the query and user', async () => {
      const expected = { items: [] };
      mockService.listMovements.mockResolvedValue(expected);

      const query = { limit: 25 };
      const result = await controller.listMovements(query, mockUser);

      expect(result).toBe(expected);
      expect(mockService.listMovements).toHaveBeenCalledWith(mockUser, query);
    });
  });
});
