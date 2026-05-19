import { UserRole } from '@prisma/client';

import { PoValidationService } from '../po-validation.service';

const mockPrisma = {
  rfqLineItem: { findMany: jest.fn() },
  bulkOrderLineItem: { findMany: jest.fn() },
};

const companyAdmin = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};

describe('PoValidationService', () => {
  let service: PoValidationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PoValidationService(mockPrisma as never);
  });

  it('returns empty suggestions when no line items have materialId or materialName', async () => {
    const result = await service.validateItems(
      { projectId: 'p-1', lineItems: [{ quantity: 1 }] } as never,
      companyAdmin,
    );
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].rfqMatch).toBeNull();
    expect(result.suggestions[0].bulkOrderMatch).toBeNull();
    expect(mockPrisma.rfqLineItem.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.bulkOrderLineItem.findMany).not.toHaveBeenCalled();
  });

  it('matches by materialId in RFQ', async () => {
    mockPrisma.rfqLineItem.findMany.mockResolvedValue([
      {
        materialId: 'mat-1',
        quantity: 10,
        material: { id: 'mat-1', name: 'Steel' },
        rfq: {
          id: 'rfq-1',
          rfqNumber: 'RFQ-001',
          quoteResponses: [
            { id: 'qr-1', vendorId: 'v-1', totalCost: 500, vendor: { legalName: 'VendorCo' } },
          ],
        },
      },
    ]);
    mockPrisma.bulkOrderLineItem.findMany.mockResolvedValue([]);

    const result = await service.validateItems(
      {
        projectId: 'p-1',
        lineItems: [{ materialId: 'mat-1', materialName: 'Steel', quantity: 10 }],
      } as never,
      companyAdmin,
    );

    expect(result.suggestions[0].rfqMatch).not.toBeNull();
    expect(result.suggestions[0].rfqMatch?.rfqId).toBe('rfq-1');
    expect(result.suggestions[0].rfqMatch?.vendorName).toBe('VendorCo');
    expect(result.suggestions[0].rfqMatch?.agreedPrice).toBe(50); // 500/10
  });

  it('matches by materialName in RFQ (case-insensitive)', async () => {
    mockPrisma.rfqLineItem.findMany.mockResolvedValue([
      {
        materialId: 'mat-1',
        quantity: 5,
        material: { id: 'mat-1', name: 'Concrete' },
        rfq: {
          id: 'rfq-2',
          rfqNumber: 'RFQ-002',
          quoteResponses: [
            { id: 'qr-2', vendorId: 'v-2', totalCost: 1000, vendor: { legalName: 'SupplyCo' } },
          ],
        },
      },
    ]);
    mockPrisma.bulkOrderLineItem.findMany.mockResolvedValue([]);

    const result = await service.validateItems(
      {
        projectId: 'p-1',
        lineItems: [{ materialName: 'concrete', quantity: 5 }],
      } as never,
      companyAdmin,
    );

    expect(result.suggestions[0].rfqMatch).not.toBeNull();
    expect(result.suggestions[0].rfqMatch?.rfqNumber).toBe('RFQ-002');
  });

  it('matches bulk orders by description', async () => {
    mockPrisma.rfqLineItem.findMany.mockResolvedValue([]);
    mockPrisma.bulkOrderLineItem.findMany.mockResolvedValue([
      {
        description: 'Steel Rebar',
        itemReference: 'SR-01',
        qtyRemaining: 100,
        pricePerUnit: 25,
        bulkOrder: { id: 'bo-1', vendorId: 'v-3', vendor: { legalName: 'MetalCo' } },
      },
    ]);

    const result = await service.validateItems(
      {
        projectId: 'p-1',
        lineItems: [{ materialName: 'Steel Rebar', quantity: 10 }],
      } as never,
      companyAdmin,
    );

    expect(result.suggestions[0].bulkOrderMatch).not.toBeNull();
    expect(result.suggestions[0].bulkOrderMatch?.bulkOrderId).toBe('bo-1');
    expect(result.suggestions[0].bulkOrderMatch?.remainingQty).toBe(100);
    expect(result.suggestions[0].bulkOrderMatch?.agreedPrice).toBe(25);
  });

  it('matches bulk orders by itemReference', async () => {
    mockPrisma.rfqLineItem.findMany.mockResolvedValue([]);
    mockPrisma.bulkOrderLineItem.findMany.mockResolvedValue([
      {
        description: 'Other',
        itemReference: 'Bolts',
        qtyRemaining: 50,
        pricePerUnit: 5,
        bulkOrder: { id: 'bo-2', vendorId: 'v-4', vendor: { legalName: 'BoltCo' } },
      },
    ]);

    const result = await service.validateItems(
      {
        projectId: 'p-1',
        lineItems: [{ materialName: 'bolts', quantity: 20 }],
      } as never,
      companyAdmin,
    );

    expect(result.suggestions[0].bulkOrderMatch).not.toBeNull();
    expect(result.suggestions[0].bulkOrderMatch?.vendorName).toBe('BoltCo');
  });

  it('returns null for non-matching items', async () => {
    mockPrisma.rfqLineItem.findMany.mockResolvedValue([]);
    mockPrisma.bulkOrderLineItem.findMany.mockResolvedValue([]);

    const result = await service.validateItems(
      {
        projectId: 'p-1',
        lineItems: [{ materialName: 'Unknown Material', quantity: 1 }],
      } as never,
      companyAdmin,
    );

    expect(result.suggestions[0].rfqMatch).toBeNull();
    expect(result.suggestions[0].bulkOrderMatch).toBeNull();
  });

  it('returns null rfqMatch when no approved quote exists', async () => {
    mockPrisma.rfqLineItem.findMany.mockResolvedValue([
      {
        materialId: 'mat-1',
        quantity: 10,
        material: { id: 'mat-1', name: 'Steel' },
        rfq: { id: 'rfq-1', rfqNumber: 'RFQ-001', quoteResponses: [] },
      },
    ]);
    mockPrisma.bulkOrderLineItem.findMany.mockResolvedValue([]);

    const result = await service.validateItems(
      {
        projectId: 'p-1',
        lineItems: [{ materialId: 'mat-1', materialName: 'Steel', quantity: 10 }],
      } as never,
      companyAdmin,
    );

    expect(result.suggestions[0].rfqMatch).toBeNull();
  });

  it('handles multiple line items with mixed matches', async () => {
    mockPrisma.rfqLineItem.findMany.mockResolvedValue([
      {
        materialId: 'mat-1',
        quantity: 10,
        material: { id: 'mat-1', name: 'Steel' },
        rfq: {
          id: 'rfq-1',
          rfqNumber: 'RFQ-001',
          quoteResponses: [
            { id: 'qr-1', vendorId: 'v-1', totalCost: 500, vendor: { legalName: 'VendorCo' } },
          ],
        },
      },
    ]);
    mockPrisma.bulkOrderLineItem.findMany.mockResolvedValue([
      {
        description: 'Cement',
        itemReference: 'CEM-01',
        qtyRemaining: 200,
        pricePerUnit: 10,
        bulkOrder: { id: 'bo-1', vendorId: 'v-2', vendor: { legalName: 'CementCo' } },
      },
    ]);

    const result = await service.validateItems(
      {
        projectId: 'p-1',
        lineItems: [
          { materialId: 'mat-1', materialName: 'Steel', quantity: 10 },
          { materialName: 'Cement', quantity: 50 },
          { materialName: 'Unknown', quantity: 1 },
        ],
      } as never,
      companyAdmin,
    );

    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions[0].rfqMatch).not.toBeNull();
    expect(result.suggestions[0].bulkOrderMatch).toBeNull();
    expect(result.suggestions[1].rfqMatch).toBeNull();
    expect(result.suggestions[1].bulkOrderMatch).not.toBeNull();
    expect(result.suggestions[2].rfqMatch).toBeNull();
    expect(result.suggestions[2].bulkOrderMatch).toBeNull();
  });
});
