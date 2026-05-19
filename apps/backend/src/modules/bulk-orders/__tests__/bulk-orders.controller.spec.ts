import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';

import { BulkOrderChangeService } from '../bulk-order-change.service';
import { BulkOrdersController } from '../bulk-orders.controller';
import { BulkOrdersService } from '../bulk-orders.service';

const mockService = {
  listBulkOrders: jest.fn(),
  getBulkOrder: jest.fn(),
  createBulkOrder: jest.fn(),
  updateBulkOrder: jest.fn(),
  deleteBulkOrder: jest.fn(),
  updateLineItem: jest.fn(),
  createDrawdown: jest.fn(),
};

const mockChangeService = {
  proposeChange: jest.fn(),
  listChangeRequests: jest.fn(),
  approveChange: jest.fn(),
  rejectChange: jest.fn(),
  cancelBulkOrder: jest.fn(),
};

const mockUser = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};

describe('BulkOrdersController', () => {
  let controller: BulkOrdersController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BulkOrdersController],
      providers: [
        { provide: BulkOrdersService, useValue: mockService },
        { provide: BulkOrderChangeService, useValue: mockChangeService },
      ],
    }).compile();

    controller = module.get<BulkOrdersController>(BulkOrdersController);
  });

  describe('listBulkOrders', () => {
    it('delegates to service', async () => {
      const query = { page: 1 };
      const expected = { items: [], meta: { page: 1, limit: 25, total: 0, totalPages: 0 } };
      mockService.listBulkOrders.mockResolvedValue(expected);

      const result = await controller.listBulkOrders(query as never, mockUser);
      expect(mockService.listBulkOrders).toHaveBeenCalledWith(query, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('getBulkOrder', () => {
    it('delegates to service', async () => {
      const expected = { bulkId: 'bo-1' };
      mockService.getBulkOrder.mockResolvedValue(expected);

      const result = await controller.getBulkOrder('bo-1', mockUser);
      expect(mockService.getBulkOrder).toHaveBeenCalledWith('bo-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('createBulkOrder', () => {
    it('delegates to service', async () => {
      const dto = { projectId: 'p1', vendorId: 'v1', lineItems: [] };
      const expected = { bulkId: 'new-bo' };
      mockService.createBulkOrder.mockResolvedValue(expected);

      const result = await controller.createBulkOrder(dto as never, mockUser);
      expect(mockService.createBulkOrder).toHaveBeenCalledWith(dto, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('updateBulkOrder', () => {
    it('delegates to service', async () => {
      const dto = { brands: 'NewBrand' };
      const expected = { bulkId: 'bo-1' };
      mockService.updateBulkOrder.mockResolvedValue(expected);

      const result = await controller.updateBulkOrder('bo-1', dto as never, mockUser);
      expect(mockService.updateBulkOrder).toHaveBeenCalledWith('bo-1', dto, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('deleteBulkOrder', () => {
    it('delegates to service', async () => {
      mockService.deleteBulkOrder.mockResolvedValue({ deleted: true });

      const result = await controller.deleteBulkOrder('bo-1', mockUser);
      expect(mockService.deleteBulkOrder).toHaveBeenCalledWith('bo-1', mockUser);
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('updateLineItem', () => {
    it('delegates to service', async () => {
      const dto = { qty: 600 };
      const expected = { bulkId: 'bo-1' };
      mockService.updateLineItem.mockResolvedValue(expected);

      const result = await controller.updateLineItem('bo-1', 'li-1', dto as never, mockUser);
      expect(mockService.updateLineItem).toHaveBeenCalledWith('bo-1', 'li-1', dto, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('createDrawdown', () => {
    it('delegates to service', async () => {
      const dto = { lineItemId: 'li-1', quantity: 100 };
      const expected = { id: 'dd-1' };
      mockService.createDrawdown.mockResolvedValue(expected);

      const result = await controller.createDrawdown('bo-1', dto as never, mockUser);
      expect(mockService.createDrawdown).toHaveBeenCalledWith('bo-1', dto, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('proposeChange', () => {
    it('delegates to change service', async () => {
      const dto = { message: 'extend deadline' };
      mockChangeService.proposeChange.mockResolvedValue({ id: 'cr-1' });

      const result = await controller.proposeChange('bo-1', dto as never, mockUser);
      expect(mockChangeService.proposeChange).toHaveBeenCalledWith('bo-1', dto, mockUser);
      expect(result).toEqual({ id: 'cr-1' });
    });
  });

  describe('listChangeRequests', () => {
    it('delegates to change service', async () => {
      mockChangeService.listChangeRequests.mockResolvedValue([]);

      const result = await controller.listChangeRequests('bo-1', mockUser);
      expect(mockChangeService.listChangeRequests).toHaveBeenCalledWith('bo-1', mockUser);
      expect(result).toEqual([]);
    });
  });

  describe('approveChange', () => {
    it('delegates to change service', async () => {
      mockChangeService.approveChange.mockResolvedValue({ approved: true });

      const result = await controller.approveChange('bo-1', 'cr-1', mockUser);
      expect(mockChangeService.approveChange).toHaveBeenCalledWith('bo-1', 'cr-1', mockUser);
      expect(result).toEqual({ approved: true });
    });
  });

  describe('rejectChange', () => {
    it('delegates to change service', async () => {
      const dto = { reason: 'No' };
      mockChangeService.rejectChange.mockResolvedValue({ rejected: true });

      const result = await controller.rejectChange('bo-1', 'cr-1', dto as never, mockUser);
      expect(mockChangeService.rejectChange).toHaveBeenCalledWith('bo-1', 'cr-1', dto, mockUser);
      expect(result).toEqual({ rejected: true });
    });
  });

  describe('cancelBulkOrder', () => {
    it('delegates to change service', async () => {
      mockChangeService.cancelBulkOrder.mockResolvedValue({ cancelled: true });

      const result = await controller.cancelBulkOrder('bo-1', mockUser);
      expect(mockChangeService.cancelBulkOrder).toHaveBeenCalledWith('bo-1', mockUser);
      expect(result).toEqual({ cancelled: true });
    });
  });
});
