import { BulkOrderListQueryDto } from '@forethread/shared-types';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BulkOrderStatus, UserRole } from '@prisma/client';

import { BulkOrdersService } from '../bulk-orders.service';

/** Build a query object that satisfies the DTO (including computed skip/take). */
function q(overrides: Partial<BulkOrderListQueryDto> = {}): BulkOrderListQueryDto {
  return Object.assign(new BulkOrderListQueryDto(), overrides);
}

const companyAdmin = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};
const vendor = {
  id: 'v-1',
  email: 'vendor@test.com',
  role: UserRole.VENDOR,
  companyId: 'vendor-comp-1',
};
const superAdmin = {
  id: 'sa-1',
  email: 'sa@test.com',
  role: UserRole.SUPER_ADMIN,
  companyId: null,
};

const mockPrisma = {
  bulkOrder: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  bulkOrderLineItem: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  drawdown: {
    create: jest.fn(),
  },
};

/** Helper: a full bulk order DB record for getBulkOrder mocking */
function fullBo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bo-1',
    status: BulkOrderStatus.ACTIVE,
    createdAt: new Date('2026-03-01'),
    endDate: new Date('2026-12-31'),
    project: { name: 'Alpha', code: 'PRJ-2026-001' },
    company: { legalName: 'TestCo' },
    vendor: { legalName: 'VendorCo' },
    rfq: { rfqNumber: 'RFQ-2026-007' },
    createdBy: { name: 'PO User' },
    lineItems: [
      {
        id: 'li-1',
        itemReference: 'BO-1-ITEM-1',
        description: 'Steel Beams',
        qty: 500,
        unit: 'tonnes',
        ordered: 150,
        qtyRemaining: 350,
        deliveriesPercent: 30,
        pricePerUnit: 45.5,
        totalLineInc: 22750,
      },
    ],
    drawdowns: [],
    ...overrides,
  };
}

describe('BulkOrdersService', () => {
  let service: BulkOrdersService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new BulkOrdersService(mockPrisma as never);
  });

  describe('listBulkOrders', () => {
    beforeEach(() => {
      mockPrisma.bulkOrder.findMany.mockResolvedValue([]);
      mockPrisma.bulkOrder.count.mockResolvedValue(0);
    });

    it('scopes CompanyAdmin to company bulk orders', async () => {
      await service.listBulkOrders(q(), companyAdmin);
      const where = mockPrisma.bulkOrder.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBe('comp-1');
    });

    it('scopes Vendor to their bulk orders', async () => {
      await service.listBulkOrders(q(), vendor);
      const where = mockPrisma.bulkOrder.findMany.mock.calls[0][0].where;
      expect(where.vendorId).toBe('vendor-comp-1');
    });

    it('SuperAdmin sees all bulk orders', async () => {
      await service.listBulkOrders(q(), superAdmin);
      const where = mockPrisma.bulkOrder.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('companyId');
      expect(where).not.toHaveProperty('vendorId');
    });

    it('filters by projectId', async () => {
      await service.listBulkOrders(q({ projectId: 'proj-1' }), companyAdmin);
      const where = mockPrisma.bulkOrder.findMany.mock.calls[0][0].where;
      expect(where.projectId).toBe('proj-1');
    });

    it('filters by vendorId', async () => {
      await service.listBulkOrders(q({ vendorId: 'v-1' }), companyAdmin);
      const where = mockPrisma.bulkOrder.findMany.mock.calls[0][0].where;
      expect(where.vendorId).toBe('v-1');
    });

    it('applies search', async () => {
      await service.listBulkOrders(q({ search: 'test' }), companyAdmin);
      const where = mockPrisma.bulkOrder.findMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(3);
    });

    it('returns paginated response', async () => {
      mockPrisma.bulkOrder.count.mockResolvedValue(20);
      const result = await service.listBulkOrders(q({ page: 1, limit: 10 }), companyAdmin);
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 20, totalPages: 2 });
    });

    it('computes delivery percentage from line items', async () => {
      mockPrisma.bulkOrder.findMany.mockResolvedValue([
        {
          id: 'bo-1',
          projectId: 'proj-1',
          companyId: 'comp-1',
          vendorId: 'vendor-1',
          bulkOrderNumber: 'BO-001',
          brands: 'BlueScope',
          totalAmount: null,
          createdAt: new Date('2026-03-01'),
          endDate: null,
          status: 'ACTIVE',
          project: { name: 'Alpha', code: 'PRJ-2026-001' },
          company: { legalName: 'ContractorCo' },
          vendor: { legalName: 'VendorCo' },
          _count: { lineItems: 2 },
          lineItems: [
            { deliveriesPercent: 30, totalLineInc: 5000, qty: 10, qtyRemaining: 5, ordered: 5 },
            { deliveriesPercent: 50, totalLineInc: 8000, qty: 20, qtyRemaining: 10, ordered: 10 },
          ],
        },
      ]);
      mockPrisma.bulkOrder.count.mockResolvedValue(1);

      const result = await service.listBulkOrders(q(), companyAdmin);
      // (30+50)/2 = 40
      expect(result.items[0].deliveriesPercent).toBe(40);
      // No totalAmount, so sum of line items: 5000+8000=13000
      expect(result.items[0].totalAmount).toBe(13000);
      // Exposes the human-readable project code (not the project UUID) for the list column.
      expect(result.items[0].projectCode).toBe('PRJ-2026-001');
    });

    it('sorts by id', async () => {
      await service.listBulkOrders(q({ sortBy: 'id' }), companyAdmin);
      const orderBy = mockPrisma.bulkOrder.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.id).toBeDefined();
    });

    it('sorts by projectName', async () => {
      await service.listBulkOrders(q({ sortBy: 'projectName' }), companyAdmin);
      const orderBy = mockPrisma.bulkOrder.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.project).toBeDefined();
    });

    it('sorts by vendorName', async () => {
      await service.listBulkOrders(q({ sortBy: 'vendorName' }), companyAdmin);
      const orderBy = mockPrisma.bulkOrder.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.vendor).toBeDefined();
    });

    it('sorts by totalAmount', async () => {
      await service.listBulkOrders(q({ sortBy: 'totalAmount' }), companyAdmin);
      const orderBy = mockPrisma.bulkOrder.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.totalAmount).toBeDefined();
    });

    it('filters by ACTIVE status without search', async () => {
      await service.listBulkOrders(q({ status: 'ACTIVE' }), companyAdmin);
      const where = mockPrisma.bulkOrder.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(BulkOrderStatus.ACTIVE);
      // Without search, OR is set directly for date condition
      expect(where.OR).toBeDefined();
    });

    it('filters by ACTIVE status with search (combines via AND)', async () => {
      await service.listBulkOrders(q({ status: 'ACTIVE', search: 'test' }), companyAdmin);
      const where = mockPrisma.bulkOrder.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(BulkOrderStatus.ACTIVE);
      expect(where.AND).toBeDefined();
      expect(where.OR).toBeUndefined();
    });

    it('filters by EXPIRED status', async () => {
      await service.listBulkOrders(q({ status: 'EXPIRED' }), companyAdmin);
      const where = mockPrisma.bulkOrder.findMany.mock.calls[0][0].where;
      expect(where.endDate).toBeDefined();
      expect(where.endDate.lt).toBeInstanceOf(Date);
    });

    it('filters by FULLY_DRAWN status', async () => {
      await service.listBulkOrders(q({ status: 'FULLY_DRAWN' }), companyAdmin);
      const where = mockPrisma.bulkOrder.findMany.mock.calls[0][0].where;
      expect(where.lineItems).toEqual({ every: { qtyRemaining: 0 } });
    });

    it('handles zero line items for deliveriesPercent', async () => {
      mockPrisma.bulkOrder.findMany.mockResolvedValue([
        {
          id: 'bo-2',
          projectId: 'proj-1',
          companyId: 'comp-1',
          vendorId: 'vendor-2',
          bulkOrderNumber: 'BO-002',
          brands: null,
          totalAmount: 1000,
          createdAt: new Date(),
          endDate: null,
          project: { name: 'Beta' },
          company: { legalName: 'ContractorCo' },
          vendor: { legalName: 'V2' },
          _count: { lineItems: 0 },
          lineItems: [],
          status: 'ACTIVE',
        },
      ]);
      mockPrisma.bulkOrder.count.mockResolvedValue(1);

      const result = await service.listBulkOrders(q(), companyAdmin);
      expect(result.items[0].deliveriesPercent).toBe(0);
      expect(result.items[0].totalAmount).toBe(1000);
    });

    it('computes consumption percent and qty fields from line items', async () => {
      mockPrisma.bulkOrder.findMany.mockResolvedValue([
        {
          id: 'bo-3',
          projectId: 'proj-1',
          companyId: 'comp-1',
          vendorId: 'vendor-3',
          bulkOrderNumber: 'BO-003',
          brands: 'Brand',
          totalAmount: 5000,
          createdAt: new Date('2026-03-01'),
          endDate: new Date('2026-12-31'),
          project: { name: 'Gamma' },
          company: { legalName: 'ContractorCo' },
          vendor: { legalName: 'V3' },
          _count: { lineItems: 2 },
          status: 'ACTIVE',
          lineItems: [
            {
              deliveriesPercent: 20,
              totalLineInc: 2500,
              qty: 100,
              qtyRemaining: 60,
              ordered: 40,
              itemReference: 'REF-1',
            },
            {
              deliveriesPercent: 80,
              totalLineInc: 2500,
              qty: 200,
              qtyRemaining: 40,
              ordered: 160,
              itemReference: 'REF-2',
            },
          ],
        },
      ]);
      mockPrisma.bulkOrder.count.mockResolvedValue(1);

      const result = await service.listBulkOrders(q(), companyAdmin);
      const item = result.items[0];
      expect(item.totalQtyOrdered).toBe(300); // 100+200
      expect(item.totalQtyRemaining).toBe(100); // 60+40
      // consumption: item1 = 40/100*100=40, item2 = 160/200*100=80, avg = (40+80)/2 = 60
      expect(item.consumptionPercent).toBe(60);
      expect(item.validUntil).toBeDefined();
    });

    it('handles line items with zero qty in consumption calculation', async () => {
      mockPrisma.bulkOrder.findMany.mockResolvedValue([
        {
          id: 'bo-4',
          projectId: 'proj-1',
          companyId: 'comp-1',
          vendorId: 'vendor-4',
          bulkOrderNumber: 'BO-004',
          brands: null,
          totalAmount: null,
          createdAt: new Date('2026-03-01'),
          endDate: null,
          project: { name: 'Delta' },
          company: { legalName: 'ContractorCo' },
          vendor: { legalName: 'V4' },
          _count: { lineItems: 1 },
          status: 'ACTIVE',
          lineItems: [
            {
              deliveriesPercent: 0,
              totalLineInc: 0,
              qty: 0,
              qtyRemaining: 0,
              ordered: 0,
              itemReference: 'REF-0',
            },
          ],
        },
      ]);
      mockPrisma.bulkOrder.count.mockResolvedValue(1);

      const result = await service.listBulkOrders(q(), companyAdmin);
      expect(result.items[0].consumptionPercent).toBe(0);
    });
  });

  describe('getBulkOrder', () => {
    it('returns bulk order with line items', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(fullBo());

      const result = await service.getBulkOrder('bo-1', companyAdmin);
      expect(result.bulkId).toBe('bo-1');
      expect(result.rfqReference).toBe('RFQ-2026-007');
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].pricePerUnit).toBe(45.5);
    });

    it('returns null rfqReference when no rfq', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(fullBo({ rfq: null }));
      const result = await service.getBulkOrder('bo-1', companyAdmin);
      expect(result.rfqReference).toBeNull();
    });

    it('throws NotFoundException for missing bulk order', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(null);
      await expect(service.getBulkOrder('missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('handles empty line items (overallConsumptionPercent = 0)', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(fullBo({ lineItems: [], endDate: null }));
      const result = await service.getBulkOrder('bo-1', companyAdmin);
      expect(result.overallConsumptionPercent).toBe(0);
      expect(result.lineItems).toEqual([]);
      expect(result.endDate).toBeNull();
    });

    it('computes consumptionPercent per line item (including zero qty)', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(
        fullBo({
          lineItems: [
            {
              id: 'li-z',
              itemReference: 'ZERO',
              description: 'Zero qty item',
              qty: 0,
              unit: 'pcs',
              ordered: 0,
              qtyRemaining: 0,
              deliveriesPercent: 0,
              pricePerUnit: 10,
              totalLineInc: 0,
            },
          ],
        }),
      );
      const result = await service.getBulkOrder('bo-1', companyAdmin);
      expect(result.lineItems[0].consumptionPercent).toBe(0);
    });
  });

  describe('createBulkOrder', () => {
    it('creates bulk order with line items and calculates total', async () => {
      mockPrisma.bulkOrder.create.mockResolvedValue({ id: 'new-bo' });
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(fullBo({ id: 'new-bo' }));

      const dto = {
        projectId: 'proj-1',
        vendorId: 'vendor-1',
        brands: 'BlueScope',
        endDate: '2026-12-31',
        lineItems: [
          {
            itemReference: 'ITEM-1',
            description: 'Beams',
            qty: 100,
            unit: 'tonnes',
            pricePerUnit: 50,
          },
          {
            itemReference: 'ITEM-2',
            description: 'Bolts',
            qty: 200,
            unit: 'pcs',
            pricePerUnit: 10,
          },
        ],
      };

      await service.createBulkOrder(dto as never, companyAdmin);

      const createCall = mockPrisma.bulkOrder.create.mock.calls[0][0];
      expect(createCall.data.projectId).toBe('proj-1');
      expect(createCall.data.companyId).toBe('comp-1');
      // totalAmount = 100*50 + 200*10 = 7000
      expect(createCall.data.totalAmount).toBe(7000);
      expect(createCall.data.lineItems.create).toHaveLength(2);
      expect(createCall.data.lineItems.create[0].qtyRemaining).toBe(100);
    });
  });

  describe('updateBulkOrder', () => {
    it('updates brands and endDate', async () => {
      mockPrisma.bulkOrder.findUnique
        .mockResolvedValueOnce({ id: 'bo-1', status: BulkOrderStatus.ACTIVE })
        .mockResolvedValueOnce(fullBo());
      mockPrisma.bulkOrder.update.mockResolvedValue({});

      await service.updateBulkOrder(
        'bo-1',
        { brands: 'NewBrand', endDate: '2027-06-01' } as never,
        companyAdmin,
      );
      expect(mockPrisma.bulkOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'bo-1' } }),
      );
    });

    it('updates status only', async () => {
      mockPrisma.bulkOrder.findUnique
        .mockResolvedValueOnce({ id: 'bo-1', status: BulkOrderStatus.ACTIVE })
        .mockResolvedValueOnce(fullBo());
      mockPrisma.bulkOrder.update.mockResolvedValue({});

      await service.updateBulkOrder('bo-1', { status: 'COMPLETED' } as never, companyAdmin);
      const updateCall = mockPrisma.bulkOrder.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('COMPLETED');
    });

    it('updates with no optional fields provided', async () => {
      mockPrisma.bulkOrder.findUnique
        .mockResolvedValueOnce({ id: 'bo-1', status: BulkOrderStatus.ACTIVE })
        .mockResolvedValueOnce(fullBo());
      mockPrisma.bulkOrder.update.mockResolvedValue({});

      await service.updateBulkOrder('bo-1', {} as never, companyAdmin);
      expect(mockPrisma.bulkOrder.update).toHaveBeenCalled();
    });

    it('throws NotFoundException for missing bulk order', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(null);
      await expect(service.updateBulkOrder('missing', {} as never, companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException for COMPLETED status', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({
        id: 'bo-1',
        status: BulkOrderStatus.COMPLETED,
      });
      await expect(
        service.updateBulkOrder('bo-1', { brands: 'X' } as never, companyAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for CANCELLED status', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({
        id: 'bo-1',
        status: BulkOrderStatus.CANCELLED,
      });
      await expect(
        service.updateBulkOrder('bo-1', { brands: 'X' } as never, companyAdmin),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteBulkOrder', () => {
    it('deletes existing bulk order', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({ id: 'bo-1' });
      mockPrisma.bulkOrder.delete.mockResolvedValue({});

      const result = await service.deleteBulkOrder('bo-1', companyAdmin);
      expect(result).toEqual({ deleted: true });
      expect(mockPrisma.bulkOrder.delete).toHaveBeenCalledWith({ where: { id: 'bo-1' } });
    });

    it('throws NotFoundException for missing bulk order', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(null);
      await expect(service.deleteBulkOrder('missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateLineItem', () => {
    it('updates line item and recalculates totals', async () => {
      mockPrisma.bulkOrder.findUnique
        .mockResolvedValueOnce({ id: 'bo-1', status: BulkOrderStatus.ACTIVE })
        .mockResolvedValueOnce(fullBo());
      mockPrisma.bulkOrderLineItem.findFirst.mockResolvedValue({
        id: 'li-1',
        bulkOrderId: 'bo-1',
        qty: 500,
        qtyRemaining: 350,
        pricePerUnit: 45.5,
      });
      mockPrisma.bulkOrderLineItem.update.mockResolvedValue({});
      mockPrisma.bulkOrderLineItem.findMany.mockResolvedValue([{ totalLineInc: 30000 }]);
      mockPrisma.bulkOrder.update.mockResolvedValue({});

      await service.updateLineItem(
        'bo-1',
        'li-1',
        { qty: 600, pricePerUnit: 50 } as never,
        companyAdmin,
      );

      expect(mockPrisma.bulkOrderLineItem.update).toHaveBeenCalled();
      expect(mockPrisma.bulkOrder.update).toHaveBeenCalled();
    });

    it('updates all optional line item fields', async () => {
      mockPrisma.bulkOrder.findUnique
        .mockResolvedValueOnce({ id: 'bo-1', status: BulkOrderStatus.ACTIVE })
        .mockResolvedValueOnce(fullBo());
      mockPrisma.bulkOrderLineItem.findFirst.mockResolvedValue({
        id: 'li-1',
        bulkOrderId: 'bo-1',
        qty: 500,
        qtyRemaining: 350,
        pricePerUnit: 45.5,
      });
      mockPrisma.bulkOrderLineItem.update.mockResolvedValue({});
      mockPrisma.bulkOrderLineItem.findMany.mockResolvedValue([{ totalLineInc: 30000 }]);
      mockPrisma.bulkOrder.update.mockResolvedValue({});

      await service.updateLineItem(
        'bo-1',
        'li-1',
        {
          itemReference: 'REF-NEW',
          description: 'Updated desc',
          qty: 700,
          unit: 'kg',
          pricePerUnit: 55,
        } as never,
        companyAdmin,
      );

      const updateCall = mockPrisma.bulkOrderLineItem.update.mock.calls[0][0];
      expect(updateCall.data.itemReference).toBe('REF-NEW');
      expect(updateCall.data.description).toBe('Updated desc');
      expect(updateCall.data.unit).toBe('kg');
      expect(updateCall.data.qty).toBe(700);
    });

    it('uses existing qty and price when not provided in dto', async () => {
      mockPrisma.bulkOrder.findUnique
        .mockResolvedValueOnce({ id: 'bo-1', status: BulkOrderStatus.ACTIVE })
        .mockResolvedValueOnce(fullBo());
      mockPrisma.bulkOrderLineItem.findFirst.mockResolvedValue({
        id: 'li-1',
        bulkOrderId: 'bo-1',
        qty: 500,
        qtyRemaining: 350,
        pricePerUnit: 45.5,
      });
      mockPrisma.bulkOrderLineItem.update.mockResolvedValue({});
      mockPrisma.bulkOrderLineItem.findMany.mockResolvedValue([{ totalLineInc: 22750 }]);
      mockPrisma.bulkOrder.update.mockResolvedValue({});

      await service.updateLineItem(
        'bo-1',
        'li-1',
        { description: 'Only desc changed' } as never,
        companyAdmin,
      );

      const updateCall = mockPrisma.bulkOrderLineItem.update.mock.calls[0][0];
      // totalLineInc should be 500 * 45.5 = 22750 (unchanged)
      expect(updateCall.data.totalLineInc).toBe(22750);
    });

    it('throws NotFoundException for missing bulk order', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(null);
      await expect(
        service.updateLineItem('missing', 'li-1', {} as never, companyAdmin),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for COMPLETED bulk order', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({
        id: 'bo-1',
        status: BulkOrderStatus.COMPLETED,
      });
      await expect(
        service.updateLineItem('bo-1', 'li-1', {} as never, companyAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for missing line item', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({
        id: 'bo-1',
        status: BulkOrderStatus.ACTIVE,
      });
      mockPrisma.bulkOrderLineItem.findFirst.mockResolvedValue(null);
      await expect(
        service.updateLineItem('bo-1', 'missing', {} as never, companyAdmin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createDrawdown', () => {
    it('creates drawdown and updates line item quantities', async () => {
      mockPrisma.bulkOrder.findUnique
        .mockResolvedValueOnce({ id: 'bo-1', status: BulkOrderStatus.ACTIVE })
        .mockResolvedValueOnce(fullBo());
      mockPrisma.bulkOrderLineItem.findFirst.mockResolvedValue({
        id: 'li-1',
        bulkOrderId: 'bo-1',
        qty: 500,
        ordered: 150,
        qtyRemaining: 350,
      });
      mockPrisma.drawdown.create.mockResolvedValue({
        id: 'dd-1',
        bulkOrderId: 'bo-1',
        quantity: 100,
        createdAt: new Date('2026-03-15'),
      });
      mockPrisma.bulkOrderLineItem.update.mockResolvedValue({});

      const result = await service.createDrawdown(
        'bo-1',
        { lineItemId: 'li-1', quantity: 100 } as never,
        companyAdmin,
      );

      expect(result.id).toBe('dd-1');
      expect(result.quantity).toBe(100);
      // qtyRemaining = 350-100=250, ordered = 150+100=250, deliveries = 250/500*100 = 50
      const updateCall = mockPrisma.bulkOrderLineItem.update.mock.calls[0][0];
      expect(updateCall.data.qtyRemaining).toBe(250);
      expect(updateCall.data.ordered).toBe(250);
      expect(updateCall.data.deliveriesPercent).toBe(50);
    });

    it('throws NotFoundException for missing bulk order', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(null);
      await expect(
        service.createDrawdown(
          'missing',
          { lineItemId: 'li-1', quantity: 10 } as never,
          companyAdmin,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for non-ACTIVE bulk order', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({
        id: 'bo-1',
        status: BulkOrderStatus.EXPIRED,
      });
      await expect(
        service.createDrawdown('bo-1', { lineItemId: 'li-1', quantity: 10 } as never, companyAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for missing line item', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({
        id: 'bo-1',
        status: BulkOrderStatus.ACTIVE,
      });
      mockPrisma.bulkOrderLineItem.findFirst.mockResolvedValue(null);
      await expect(
        service.createDrawdown(
          'bo-1',
          { lineItemId: 'missing', quantity: 10 } as never,
          companyAdmin,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when quantity exceeds remaining', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({
        id: 'bo-1',
        status: BulkOrderStatus.ACTIVE,
      });
      mockPrisma.bulkOrderLineItem.findFirst.mockResolvedValue({
        id: 'li-1',
        bulkOrderId: 'bo-1',
        qty: 500,
        ordered: 150,
        qtyRemaining: 5,
      });
      await expect(
        service.createDrawdown(
          'bo-1',
          { lineItemId: 'li-1', quantity: 100 } as never,
          companyAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('handles zero qty line item (deliveriesPercent = 0)', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValueOnce({
        id: 'bo-1',
        status: BulkOrderStatus.ACTIVE,
      });
      mockPrisma.bulkOrderLineItem.findFirst.mockResolvedValue({
        id: 'li-1',
        bulkOrderId: 'bo-1',
        qty: 0,
        ordered: 0,
        qtyRemaining: 5,
      });
      mockPrisma.drawdown.create.mockResolvedValue({
        id: 'dd-1',
        bulkOrderId: 'bo-1',
        quantity: 1,
        createdAt: new Date('2026-03-15'),
      });
      mockPrisma.bulkOrderLineItem.update.mockResolvedValue({});

      const result = await service.createDrawdown(
        'bo-1',
        { lineItemId: 'li-1', quantity: 1 } as never,
        companyAdmin,
      );

      expect(result.id).toBe('dd-1');
      const updateCall = mockPrisma.bulkOrderLineItem.update.mock.calls[0][0];
      expect(updateCall.data.deliveriesPercent).toBe(0);
    });
  });

  describe('listBulkOrders — additional branches', () => {
    beforeEach(() => {
      mockPrisma.bulkOrder.findMany.mockResolvedValue([]);
      mockPrisma.bulkOrder.count.mockResolvedValue(0);
    });

    it('uses default sortBy and sortDir when not provided', async () => {
      const query = q();
      // Ensure sortBy and sortDir are undefined to hit the ?? fallback
      delete (query as unknown as Record<string, unknown>).sortBy;
      delete (query as unknown as Record<string, unknown>).sortDir;

      await service.listBulkOrders(query, companyAdmin);
      const orderBy = mockPrisma.bulkOrder.findMany.mock.calls[0][0].orderBy;
      // Default sortBy is 'date' which maps to createdAt, default sortDir is 'desc'
      expect(orderBy.createdAt).toBe('desc');
    });

    it('uses page ?? 1 fallback when page is undefined', async () => {
      const query = q();
      delete (query as unknown as Record<string, unknown>).page;

      const result = await service.listBulkOrders(query, companyAdmin);
      expect(result.meta).toBeDefined();
      expect(result.meta.page).toBe(1);
    });
  });

  describe('createBulkOrder — additional branches', () => {
    it('sets endDate to null when not provided', async () => {
      mockPrisma.bulkOrder.create.mockResolvedValue({ id: 'new-bo' });
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(fullBo({ id: 'new-bo' }));

      const dto = {
        projectId: 'proj-1',
        vendorId: 'vendor-1',
        brands: 'BlueScope',
        lineItems: [
          {
            itemReference: 'ITEM-1',
            description: 'Beams',
            qty: 100,
            unit: 'tonnes',
            pricePerUnit: 50,
          },
        ],
      };

      await service.createBulkOrder(dto as never, companyAdmin);

      const createCall = mockPrisma.bulkOrder.create.mock.calls[0][0];
      expect(createCall.data.endDate).toBeNull();
    });

    it('uses empty string for companyId when user has no companyId', async () => {
      mockPrisma.bulkOrder.create.mockResolvedValue({ id: 'new-bo' });
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(fullBo({ id: 'new-bo' }));

      const dto = {
        projectId: 'proj-1',
        vendorId: 'vendor-1',
        brands: 'BlueScope',
        endDate: '2026-12-31',
        lineItems: [
          {
            itemReference: 'ITEM-1',
            description: 'Beams',
            qty: 100,
            unit: 'tonnes',
            pricePerUnit: 50,
          },
        ],
      };

      await service.createBulkOrder(dto as never, superAdmin);

      const createCall = mockPrisma.bulkOrder.create.mock.calls[0][0];
      expect(createCall.data.companyId).toBe('');
    });
  });

  describe('updateBulkOrder — additional branches', () => {
    it('updates projectId when provided', async () => {
      mockPrisma.bulkOrder.findUnique
        .mockResolvedValueOnce({ id: 'bo-1', status: BulkOrderStatus.ACTIVE })
        .mockResolvedValueOnce(fullBo());
      mockPrisma.bulkOrder.update.mockResolvedValue({});

      await service.updateBulkOrder('bo-1', { projectId: 'new-proj-1' } as never, companyAdmin);

      const updateCall = mockPrisma.bulkOrder.update.mock.calls[0][0];
      expect(updateCall.data.projectId).toBe('new-proj-1');
    });
  });

  describe('getBulkOrder — drawdown mapping branches', () => {
    it('maps drawdown with purchaseOrder, lineItem reference, and qtyBeforeDrawdown', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(
        fullBo({
          drawdowns: [
            {
              id: 'dd-1',
              purchaseOrderId: 'po-1',
              purchaseOrder: { poNumber: 'PO-001' },
              lineItem: { itemReference: 'REF-1', description: 'Steel' },
              quantity: 50,
              qtyBeforeDrawdown: 350,
              createdAt: new Date('2026-03-15'),
              createdBy: { name: 'User A' },
            },
          ],
        }),
      );

      const result = await service.getBulkOrder('bo-1', companyAdmin);
      expect(result.drawdowns[0].poNumber).toBe('PO-001');
      expect(result.drawdowns[0].material).toBe('REF-1');
      expect(result.drawdowns[0].remainingQty).toBe(300); // 350-50
    });

    it('maps drawdown with null purchaseOrder and fallback to description', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(
        fullBo({
          drawdowns: [
            {
              id: 'dd-2',
              purchaseOrderId: null,
              purchaseOrder: null,
              lineItem: { itemReference: null, description: 'Bolts' },
              quantity: 10,
              qtyBeforeDrawdown: null,
              createdAt: new Date('2026-03-16'),
              createdBy: { name: 'User B' },
            },
          ],
        }),
      );

      const result = await service.getBulkOrder('bo-1', companyAdmin);
      expect(result.drawdowns[0].poNumber).toBeNull();
      expect(result.drawdowns[0].material).toBe('Bolts');
      expect(result.drawdowns[0].qtyBeforeDrawdown).toBeNull();
      expect(result.drawdowns[0].remainingQty).toBeNull();
    });

    it('maps drawdown with null lineItem fields', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(
        fullBo({
          drawdowns: [
            {
              id: 'dd-3',
              purchaseOrderId: null,
              purchaseOrder: null,
              lineItem: { itemReference: null, description: null },
              quantity: 5,
              qtyBeforeDrawdown: 100,
              createdAt: new Date('2026-03-17'),
              createdBy: { name: 'User C' },
            },
          ],
        }),
      );

      const result = await service.getBulkOrder('bo-1', companyAdmin);
      expect(result.drawdowns[0].material).toBeNull();
      expect(result.drawdowns[0].remainingQty).toBe(95); // 100-5
    });

    it('returns bulkOrderNumber when available', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(fullBo({ bulkOrderNumber: 'BULK-ABC123' }));

      const result = await service.getBulkOrder('bo-1', companyAdmin);
      expect(result.bulkId).toBe('BULK-ABC123');
    });
  });
});
