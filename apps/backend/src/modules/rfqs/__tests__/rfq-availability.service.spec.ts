import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { RfqAvailabilityService } from '../rfq-availability.service';

const user = {
  id: 'user-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
} as never;

function makeTx() {
  return {
    drawdown: { create: jest.fn() },
    bulkOrderLineItem: { update: jest.fn() },
    rfqLineItem: {
      delete: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    rfq: { update: jest.fn() },
  };
}

describe('RfqAvailabilityService', () => {
  let prisma: {
    material: { findMany: jest.Mock };
    bulkOrder: { findMany: jest.Mock };
    rfq: { findFirst: jest.Mock };
    rfqLineItem: { findMany: jest.Mock };
    bulkOrderLineItem: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let rfqsService: { getRfq: jest.Mock };
  let service: RfqAvailabilityService;
  let tx: ReturnType<typeof makeTx>;

  beforeEach(() => {
    tx = makeTx();
    prisma = {
      material: { findMany: jest.fn().mockResolvedValue([]) },
      bulkOrder: { findMany: jest.fn().mockResolvedValue([]) },
      rfq: { findFirst: jest.fn() },
      rfqLineItem: { findMany: jest.fn() },
      bulkOrderLineItem: { findMany: jest.fn() },
      $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    };
    rfqsService = { getRfq: jest.fn().mockResolvedValue({ id: 'rfq-1' }) };
    service = new RfqAvailabilityService(prisma as never, rfqsService as never);
  });

  // ── checkAvailability ──────────────────────────────────────────────────────

  describe('checkAvailability', () => {
    const bulkOrder = (overrides: Record<string, unknown> = {}) => ({
      id: 'bo-1',
      bulkOrderNumber: 'BO-001',
      vendorId: 'vendor-1',
      vendor: { id: 'vendor-1', legalName: 'SteelCorp' },
      endDate: new Date('2026-12-31'),
      lineItems: [
        {
          id: 'bol-1',
          description: 'Paint Primer White 5-Gal premium',
          itemReference: 'PPW-5',
          qtyRemaining: 300,
          pricePerUnit: 12.5,
        },
      ],
      ...overrides,
    });

    it('matches a requested material against bulk lines by description overlap', async () => {
      prisma.bulkOrder.findMany.mockResolvedValue([bulkOrder()]);

      const result = await service.checkAvailability(
        {
          lineItems: [
            { index: 0, materialName: 'paint primer white 5-gal', quantity: 250, uom: 'gal' },
          ],
        },
        user,
      );

      expect(result.vendors).toEqual([{ vendorId: 'vendor-1', vendorName: 'SteelCorp' }]);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].matches).toEqual([
        expect.objectContaining({
          bulkOrderLineItemId: 'bol-1',
          vendorId: 'vendor-1',
          qtyRemaining: 300,
          pricePerUnit: 12.5,
        }),
      ]);
    });

    it('resolves catalog materialIds to names before matching', async () => {
      prisma.material.findMany.mockResolvedValue([
        { id: 'mat-1', name: 'Paint Primer White 5-Gal' },
      ]);
      prisma.bulkOrder.findMany.mockResolvedValue([bulkOrder()]);

      const result = await service.checkAvailability(
        { lineItems: [{ index: 3, materialId: 'mat-1', quantity: 10, uom: 'gal' }] },
        user,
      );

      expect(prisma.material.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['mat-1'] } } }),
      );
      expect(result.items[0]).toMatchObject({ index: 3 });
      expect(result.items[0].matches).toHaveLength(1);
    });

    it('throws Forbidden when the user has no company', async () => {
      const noCompany = { ...(user as object), companyId: null } as never;
      await expect(service.checkAvailability({ lineItems: [] }, noCompany)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.bulkOrder.findMany).not.toHaveBeenCalled();
    });

    it('returns no matches for a line with neither materialId nor materialName', async () => {
      prisma.bulkOrder.findMany.mockResolvedValue([bulkOrder()]);

      const result = await service.checkAvailability(
        { lineItems: [{ index: 0, quantity: 5, uom: 'ea' } as never] },
        user,
      );

      expect(result.items).toEqual([{ index: 0, matches: [] }]);
    });

    it('matches via itemReference when the description is empty, on an open-ended bulk order', async () => {
      prisma.bulkOrder.findMany.mockResolvedValue([
        bulkOrder({
          endDate: null,
          lineItems: [
            {
              id: 'bol-ref',
              description: null,
              // Shorter than the request: overlap must also test
              // needle.includes(haystack).
              itemReference: 'primer',
              qtyRemaining: 40,
              pricePerUnit: 7,
            },
          ],
        }),
      ]);

      const result = await service.checkAvailability(
        { lineItems: [{ index: 0, materialName: 'Paint Primer White', quantity: 5, uom: 'gal' }] },
        user,
      );

      expect(result.items[0].matches).toEqual([
        expect.objectContaining({ bulkOrderLineItemId: 'bol-ref', expirationDate: null }),
      ]);
    });

    it('lists the vendors of all matching bulk orders sorted by name', async () => {
      prisma.bulkOrder.findMany.mockResolvedValue([
        bulkOrder(),
        bulkOrder({
          id: 'bo-2',
          bulkOrderNumber: 'BO-002',
          vendorId: 'vendor-2',
          vendor: { id: 'vendor-2', legalName: 'Acme Paints' },
          lineItems: [
            {
              id: 'bol-2',
              description: 'Paint Primer White 5-Gal budget',
              itemReference: null,
              qtyRemaining: 10,
              pricePerUnit: 8,
            },
          ],
        }),
      ]);

      const result = await service.checkAvailability(
        {
          lineItems: [
            { index: 0, materialName: 'paint primer white 5-gal', quantity: 25, uom: 'gal' },
          ],
        },
        user,
      );

      expect(result.vendors).toEqual([
        { vendorId: 'vendor-2', vendorName: 'Acme Paints' },
        { vendorId: 'vendor-1', vendorName: 'SteelCorp' },
      ]);
      expect(result.items[0].matches).toHaveLength(2);
    });

    it('skips bulk lines with no remaining quantity and unmatched names', async () => {
      prisma.bulkOrder.findMany.mockResolvedValue([
        bulkOrder({
          lineItems: [
            {
              id: 'bol-dry',
              description: 'Paint Primer White 5-Gal',
              itemReference: null,
              qtyRemaining: 0,
              pricePerUnit: 9,
            },
          ],
        }),
      ]);

      const result = await service.checkAvailability(
        {
          lineItems: [
            { index: 0, materialName: 'Paint Primer White 5-Gal', quantity: 5, uom: 'gal' },
            { index: 1, materialName: 'Totally unrelated thing', quantity: 5, uom: 'ea' },
          ],
        },
        user,
      );

      expect(result.items[0].matches).toEqual([]);
      expect(result.items[1].matches).toEqual([]);
      expect(result.vendors).toEqual([]);
    });
  });

  // ── confirmCoverage ────────────────────────────────────────────────────────

  describe('confirmCoverage', () => {
    const draftRfq = { id: 'rfq-1', status: 'DRAFT', companyId: 'comp-1' };
    const allocation = { rfqLineItemId: 'rli-1', bulkOrderLineItemId: 'bol-1', quantity: 100 };
    const rfqLine = { id: 'rli-1', quantity: 250 };
    const bulkLine = {
      id: 'bol-1',
      bulkOrderId: 'bo-1',
      qty: 500,
      ordered: 200,
      qtyRemaining: 300,
    };

    it('404s when the RFQ belongs to another company', async () => {
      prisma.rfq.findFirst.mockResolvedValue(null);
      await expect(
        service.confirmCoverage('rfq-x', { allocations: [allocation] }, user),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws Forbidden when the user has no company', async () => {
      const noCompany = { ...(user as object), companyId: null } as never;
      await expect(
        service.confirmCoverage('rfq-1', { allocations: [allocation] }, noCompany),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.rfq.findFirst).not.toHaveBeenCalled();
    });

    it('does not company-scope the RFQ lookup for SUPER_ADMIN', async () => {
      const superAdmin = { ...(user as object), role: UserRole.SUPER_ADMIN } as never;
      prisma.rfq.findFirst.mockResolvedValue(null);

      await expect(
        service.confirmCoverage('rfq-1', { allocations: [allocation] }, superAdmin),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.rfq.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rfq-1' } }),
      );
    });

    it('404s when an allocation references a line of another RFQ', async () => {
      prisma.rfq.findFirst.mockResolvedValue(draftRfq);
      prisma.rfqLineItem.findMany.mockResolvedValue([]);

      await expect(
        service.confirmCoverage('rfq-1', { allocations: [allocation] }, user),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.bulkOrderLineItem.findMany).not.toHaveBeenCalled();
    });

    it('404s when an allocation references an inactive or foreign bulk-order line', async () => {
      prisma.rfq.findFirst.mockResolvedValue(draftRfq);
      prisma.rfqLineItem.findMany.mockResolvedValue([rfqLine]);
      prisma.bulkOrderLineItem.findMany.mockResolvedValue([]);

      await expect(
        service.confirmCoverage('rfq-1', { allocations: [allocation] }, user),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects non-DRAFT RFQs', async () => {
      prisma.rfq.findFirst.mockResolvedValue({ ...draftRfq, status: 'OPEN' });
      await expect(
        service.confirmCoverage('rfq-1', { allocations: [allocation] }, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('409s when allocations exceed the bulk line remaining quantity', async () => {
      prisma.rfq.findFirst.mockResolvedValue(draftRfq);
      prisma.rfqLineItem.findMany.mockResolvedValue([rfqLine]);
      prisma.bulkOrderLineItem.findMany.mockResolvedValue([{ ...bulkLine, qtyRemaining: 50 }]);

      await expect(
        service.confirmCoverage('rfq-1', { allocations: [allocation] }, user),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects coverage above the RFQ line quantity', async () => {
      prisma.rfq.findFirst.mockResolvedValue(draftRfq);
      prisma.rfqLineItem.findMany.mockResolvedValue([{ ...rfqLine, quantity: 60 }]);
      prisma.bulkOrderLineItem.findMany.mockResolvedValue([bulkLine]);

      await expect(
        service.confirmCoverage('rfq-1', { allocations: [allocation] }, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates drawdowns, decrements the bulk line and shrinks a partially covered RFQ line', async () => {
      prisma.rfq.findFirst.mockResolvedValue(draftRfq);
      prisma.rfqLineItem.findMany.mockResolvedValue([rfqLine]);
      prisma.bulkOrderLineItem.findMany.mockResolvedValue([bulkLine]);
      tx.rfqLineItem.findMany.mockResolvedValue([{ quantity: 150 }]);

      const result = await service.confirmCoverage('rfq-1', { allocations: [allocation] }, user);

      expect(tx.drawdown.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bulkOrderId: 'bo-1',
          lineItemId: 'bol-1',
          quantity: 100,
          qtyBeforeDrawdown: 300,
          createdByUserId: 'user-1',
        }),
      });
      expect(tx.bulkOrderLineItem.update).toHaveBeenCalledWith({
        where: { id: 'bol-1' },
        data: expect.objectContaining({ qtyRemaining: 200, ordered: 300 }),
      });
      // 250 requested − 100 covered → quantity shrinks, row stays.
      expect(tx.rfqLineItem.update).toHaveBeenCalledWith({
        where: { id: 'rli-1' },
        data: { quantity: 150 },
      });
      expect(tx.rfqLineItem.delete).not.toHaveBeenCalled();
      expect(tx.rfq.update).toHaveBeenCalledWith({
        where: { id: 'rfq-1' },
        data: { totalRequestedQty: 150 },
      });
      expect(result).toMatchObject({ drawdownsCreated: 1, remainingLineItems: 1 });
      expect(rfqsService.getRfq).toHaveBeenCalledWith('rfq-1', user);
    });

    it('deletes a fully covered RFQ line and reports zero remaining', async () => {
      prisma.rfq.findFirst.mockResolvedValue(draftRfq);
      prisma.rfqLineItem.findMany.mockResolvedValue([{ id: 'rli-1', quantity: 100 }]);
      prisma.bulkOrderLineItem.findMany.mockResolvedValue([bulkLine]);
      tx.rfqLineItem.findMany.mockResolvedValue([]);

      const result = await service.confirmCoverage('rfq-1', { allocations: [allocation] }, user);

      expect(tx.rfqLineItem.delete).toHaveBeenCalledWith({ where: { id: 'rli-1' } });
      expect(result).toMatchObject({ drawdownsCreated: 1, remainingLineItems: 0 });
    });

    it('accumulates repeated allocations against the same lines before validating', async () => {
      prisma.rfq.findFirst.mockResolvedValue(draftRfq);
      prisma.rfqLineItem.findMany.mockResolvedValue([rfqLine]);
      prisma.bulkOrderLineItem.findMany.mockResolvedValue([bulkLine]);
      tx.rfqLineItem.findMany.mockResolvedValue([{ quantity: 50 }]);

      const result = await service.confirmCoverage(
        'rfq-1',
        // 120 + 80 = 200 ≤ 300 remaining on the bulk line, ≤ 250 on the RFQ
        // line — legal only because the quantities are summed per line, not
        // checked per allocation.
        {
          allocations: [
            { ...allocation, quantity: 120 },
            { ...allocation, quantity: 80 },
          ],
        },
        user,
      );

      expect(tx.drawdown.create).toHaveBeenCalledTimes(2);
      // Second drawdown records the balance left by the first (300 − 120).
      expect(tx.drawdown.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({ quantity: 80, qtyBeforeDrawdown: 180 }),
      });
      expect(tx.bulkOrderLineItem.update).toHaveBeenLastCalledWith({
        where: { id: 'bol-1' },
        data: expect.objectContaining({ qtyRemaining: 100, ordered: 400 }),
      });
      // 250 − 200 → the RFQ line shrinks to 50.
      expect(tx.rfqLineItem.update).toHaveBeenCalledWith({
        where: { id: 'rli-1' },
        data: { quantity: 50 },
      });
      expect(result).toMatchObject({ drawdownsCreated: 2, remainingLineItems: 1 });
    });

    it('reports 0% deliveries progress for a zero-quantity bulk line', async () => {
      prisma.rfq.findFirst.mockResolvedValue(draftRfq);
      prisma.rfqLineItem.findMany.mockResolvedValue([rfqLine]);
      prisma.bulkOrderLineItem.findMany.mockResolvedValue([{ ...bulkLine, qty: 0 }]);
      tx.rfqLineItem.findMany.mockResolvedValue([{ quantity: 150 }]);

      await service.confirmCoverage('rfq-1', { allocations: [allocation] }, user);

      expect(tx.bulkOrderLineItem.update).toHaveBeenCalledWith({
        where: { id: 'bol-1' },
        data: expect.objectContaining({ deliveriesPercent: 0 }),
      });
    });
  });
});
