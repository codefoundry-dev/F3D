import { UserRole } from '@prisma/client';

import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { InventoryService } from '../inventory.service';

// ── Test users ────────────────────────────────────────────────────────────────
const officer: AuthenticatedUser = {
  id: 'po-1',
  email: 'po@example.com',
  role: UserRole.PROCUREMENT_OFFICER,
  companyId: 'company-1',
};
const superAdmin: AuthenticatedUser = {
  id: 'sa-1',
  email: 'sa@example.com',
  role: UserRole.SUPER_ADMIN,
  companyId: null,
};

// ── Transaction-client mock (what applyIn / issueOut receive) ──────────────────
function makeTx() {
  return {
    stockBalance: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    stockMovement: {
      create: jest.fn().mockImplementation(({ data }) => ({ id: 'mov-1', ...data })),
    },
  };
}

// ── Service + Prisma mock (for the read methods) ───────────────────────────────
function makeService() {
  const prisma = {
    stockBalance: { findMany: jest.fn().mockResolvedValue([]) },
    stockMovement: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService & {
    stockBalance: { findMany: jest.Mock };
    stockMovement: { findMany: jest.Mock };
  };
  const service = new InventoryService(prisma);
  return { service, prisma };
}

const inParams = {
  companyId: 'company-1',
  materialId: 'mat-1',
  locationId: 'loc-1',
  sourceType: 'PURCHASE_ORDER',
  sourceId: 'po-1',
  sourceLineId: 'li-1',
  createdById: 'po-1',
};

const outParams = {
  companyId: 'company-1',
  materialId: 'mat-1',
  locationId: 'loc-1',
  sourceType: 'MATERIAL_REQUEST',
  sourceId: 'mr-1',
  sourceLineId: 'li-1',
  createdById: 'po-1',
};

describe('InventoryService', () => {
  // ── applyIn (push-in) ────────────────────────────────────────────────────────
  describe('applyIn', () => {
    it('upserts the balance and writes an IN movement with balanceAfter = new onHand', async () => {
      const { service } = makeService();
      const tx = makeTx();
      tx.stockBalance.upsert.mockResolvedValue({ onHand: 10 });

      const movement = await service.applyIn(tx as never, { ...inParams, quantity: 10 });

      // Upsert: create with onHand = quantity, update increments by quantity.
      expect(tx.stockBalance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { materialId_locationId: { materialId: 'mat-1', locationId: 'loc-1' } },
          create: expect.objectContaining({ onHand: 10, companyId: 'company-1' }),
          update: { onHand: { increment: 10 } },
        }),
      );
      // Movement row carries direction, source, positive qty, and balanceAfter.
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'IN',
            source: 'PO_RECEIPT',
            quantity: 10,
            balanceAfter: 10,
            sourceType: 'PURCHASE_ORDER',
            sourceLineId: 'li-1',
          }),
        }),
      );
      expect(movement.balanceAfter).toBe(10);
    });

    it('increments an existing balance on a second receipt', async () => {
      const { service } = makeService();
      const tx = makeTx();
      // The DB increment yields 25 (10 already on hand + 15 received).
      tx.stockBalance.upsert.mockResolvedValue({ onHand: 25 });

      const movement = await service.applyIn(tx as never, { ...inParams, quantity: 15 });

      expect(tx.stockBalance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { onHand: { increment: 15 } } }),
      );
      expect(movement.balanceAfter).toBe(25);
      expect(movement.quantity).toBe(15);
    });

    it('defaults optional sourceLineId/note/createdById to null', async () => {
      const { service } = makeService();
      const tx = makeTx();
      tx.stockBalance.upsert.mockResolvedValue({ onHand: 5 });

      await service.applyIn(tx as never, {
        companyId: 'company-1',
        materialId: 'mat-1',
        locationId: 'loc-1',
        quantity: 5,
        sourceType: 'PURCHASE_ORDER',
        sourceId: 'po-1',
      });

      const data = tx.stockMovement.create.mock.calls[0][0].data;
      expect(data.sourceLineId).toBeNull();
      expect(data.note).toBeNull();
      expect(data.createdById).toBeNull();
    });
  });

  // ── issueOut (push-out) ────────────────────────────────────────────────────────
  describe('issueOut', () => {
    it('issues the full requested quantity when stock covers it', async () => {
      const { service } = makeService();
      const tx = makeTx();
      tx.stockBalance.findUnique.mockResolvedValue({ onHand: 50 });
      tx.stockBalance.update.mockResolvedValue({ onHand: 30 });

      const result = await service.issueOut(tx as never, { ...outParams, requestedQuantity: 20 });

      expect(result.issued).toBe(20);
      expect(tx.stockBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { onHand: { decrement: 20 } } }),
      );
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'OUT',
            source: 'MR_ISSUE',
            quantity: 20,
            balanceAfter: 30,
          }),
        }),
      );
      expect(result.movement).not.toBeNull();
    });

    it('clamps the issued quantity at on-hand when the request exceeds stock', async () => {
      const { service } = makeService();
      const tx = makeTx();
      tx.stockBalance.findUnique.mockResolvedValue({ onHand: 8 });
      tx.stockBalance.update.mockResolvedValue({ onHand: 0 });

      const result = await service.issueOut(tx as never, { ...outParams, requestedQuantity: 30 });

      expect(result.issued).toBe(8);
      expect(tx.stockBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { onHand: { decrement: 8 } } }),
      );
      expect(tx.stockMovement.create.mock.calls[0][0].data.balanceAfter).toBe(0);
    });

    it('returns {issued:0, movement:null} and writes nothing when on-hand is 0', async () => {
      const { service } = makeService();
      const tx = makeTx();
      tx.stockBalance.findUnique.mockResolvedValue({ onHand: 0 });

      const result = await service.issueOut(tx as never, { ...outParams, requestedQuantity: 5 });

      expect(result).toEqual({ issued: 0, movement: null });
      expect(tx.stockBalance.update).not.toHaveBeenCalled();
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('returns {issued:0, movement:null} when there is no balance row at all', async () => {
      const { service } = makeService();
      const tx = makeTx();
      tx.stockBalance.findUnique.mockResolvedValue(null);

      const result = await service.issueOut(tx as never, { ...outParams, requestedQuantity: 5 });

      expect(result).toEqual({ issued: 0, movement: null });
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('defaults optional sourceLineId/note/createdById to null on the OUT movement', async () => {
      const { service } = makeService();
      const tx = makeTx();
      tx.stockBalance.findUnique.mockResolvedValue({ onHand: 10 });
      tx.stockBalance.update.mockResolvedValue({ onHand: 5 });

      await service.issueOut(tx as never, {
        companyId: 'company-1',
        materialId: 'mat-1',
        locationId: 'loc-1',
        requestedQuantity: 5,
        sourceType: 'MATERIAL_REQUEST',
        sourceId: 'mr-1',
      });

      const data = tx.stockMovement.create.mock.calls[0][0].data;
      expect(data.sourceLineId).toBeNull();
      expect(data.note).toBeNull();
      expect(data.createdById).toBeNull();
    });
  });

  // ── getBalances ────────────────────────────────────────────────────────────────
  describe('getBalances', () => {
    it('returns an empty list for a non-super-admin with no company', async () => {
      const { service, prisma } = makeService();
      const result = await service.getBalances({ ...officer, companyId: null }, {});
      expect(result).toEqual({ items: [] });
      expect(prisma.stockBalance.findMany).not.toHaveBeenCalled();
    });

    it('scopes to the company and maps rows (including a zero balance)', async () => {
      const { service, prisma } = makeService();
      prisma.stockBalance.findMany.mockResolvedValue([
        {
          id: 'bal-1',
          materialId: 'mat-1',
          locationId: 'loc-1',
          onHand: 0,
          updatedAt: new Date('2026-06-16T00:00:00.000Z'),
          material: { id: 'mat-1', name: 'Steel Rebar #4', uom: 'pcs' },
          location: { id: 'loc-1', label: 'Yard A', address: '1 Main St' },
        },
      ]);

      const result = await service.getBalances(officer, {});

      expect(prisma.stockBalance.findMany.mock.calls[0][0].where).toEqual({
        companyId: 'company-1',
      });
      expect(result.items[0]).toMatchObject({
        id: 'bal-1',
        materialName: 'Steel Rebar #4',
        uom: 'pcs',
        locationName: 'Yard A',
        onHand: 0,
        updatedAt: '2026-06-16T00:00:00.000Z',
      });
    });

    it('applies projectId/locationId/materialId filters and skips company scope for super-admin', async () => {
      const { service, prisma } = makeService();
      await service.getBalances(superAdmin, {
        projectId: 'project-1',
        locationId: 'loc-1',
        materialId: 'mat-1',
      });
      const where = prisma.stockBalance.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBeUndefined();
      expect(where.materialId).toBe('mat-1');
      expect(where.locationId).toBe('loc-1');
      expect(where.location).toEqual({ projectId: 'project-1' });
    });

    it('falls back to the address when the location has no label and to the id when material is missing', async () => {
      const { service, prisma } = makeService();
      prisma.stockBalance.findMany.mockResolvedValue([
        {
          id: 'bal-2',
          materialId: 'mat-x',
          locationId: 'loc-2',
          onHand: 3,
          updatedAt: new Date('2026-06-16T00:00:00.000Z'),
          material: null,
          location: { id: 'loc-2', label: null, address: '2 Side St' },
        },
      ]);
      const result = await service.getBalances(officer, {});
      expect(result.items[0].materialName).toBe('mat-x');
      expect(result.items[0].uom).toBe('');
      expect(result.items[0].locationName).toBe('2 Side St');
    });
  });

  // ── listMovements ──────────────────────────────────────────────────────────────
  describe('listMovements', () => {
    it('returns an empty list for a non-super-admin with no company', async () => {
      const { service, prisma } = makeService();
      const result = await service.listMovements({ ...officer, companyId: null }, {});
      expect(result).toEqual({ items: [] });
      expect(prisma.stockMovement.findMany).not.toHaveBeenCalled();
    });

    it('scopes to company, defaults the limit to 100, and orders newest first', async () => {
      const { service, prisma } = makeService();
      await service.listMovements(officer, {});
      const args = prisma.stockMovement.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ companyId: 'company-1' });
      expect(args.take).toBe(100);
      expect(args.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('applies all filters and a custom limit, skipping company scope for super-admin', async () => {
      const { service, prisma } = makeService();
      await service.listMovements(superAdmin, {
        projectId: 'project-1',
        locationId: 'loc-1',
        materialId: 'mat-1',
        source: 'PO_RECEIPT' as never,
        sourceType: 'PURCHASE_ORDER',
        limit: 25,
      });
      const args = prisma.stockMovement.findMany.mock.calls[0][0];
      expect(args.where.companyId).toBeUndefined();
      expect(args.where.materialId).toBe('mat-1');
      expect(args.where.locationId).toBe('loc-1');
      expect(args.where.location).toEqual({ projectId: 'project-1' });
      expect(args.where.source).toBe('PO_RECEIPT');
      expect(args.where.sourceType).toBe('PURCHASE_ORDER');
      expect(args.take).toBe(25);
    });

    it('maps a movement row to the DTO shape', async () => {
      const { service, prisma } = makeService();
      prisma.stockMovement.findMany.mockResolvedValue([
        {
          id: 'mov-1',
          materialId: 'mat-1',
          locationId: 'loc-1',
          type: 'IN',
          source: 'PO_RECEIPT',
          quantity: 10,
          balanceAfter: 10,
          sourceType: 'PURCHASE_ORDER',
          sourceId: 'po-1',
          sourceLineId: 'li-1',
          note: null,
          createdById: 'po-1',
          createdAt: new Date('2026-06-16T00:00:00.000Z'),
          material: { id: 'mat-1', name: 'Steel Rebar #4', uom: 'pcs' },
          location: { id: 'loc-1', label: 'Yard A', address: '1 Main St' },
        },
      ]);
      const result = await service.listMovements(officer, {});
      expect(result.items[0]).toMatchObject({
        id: 'mov-1',
        materialName: 'Steel Rebar #4',
        uom: 'pcs',
        locationName: 'Yard A',
        type: 'IN',
        source: 'PO_RECEIPT',
        quantity: 10,
        balanceAfter: 10,
        sourceType: 'PURCHASE_ORDER',
        createdAt: '2026-06-16T00:00:00.000Z',
      });
    });

    it('falls back to address/id when label and material are absent', async () => {
      const { service, prisma } = makeService();
      prisma.stockMovement.findMany.mockResolvedValue([
        {
          id: 'mov-2',
          materialId: 'mat-x',
          locationId: 'loc-2',
          type: 'OUT',
          source: 'MR_ISSUE',
          quantity: 4,
          balanceAfter: 0,
          sourceType: 'MATERIAL_REQUEST',
          sourceId: 'mr-1',
          sourceLineId: null,
          note: null,
          createdById: null,
          createdAt: new Date('2026-06-16T00:00:00.000Z'),
          material: null,
          location: { id: 'loc-2', label: null, address: '2 Side St' },
        },
      ]);
      const result = await service.listMovements(officer, {});
      expect(result.items[0].materialName).toBe('mat-x');
      expect(result.items[0].uom).toBe('');
      expect(result.items[0].locationName).toBe('2 Side St');
    });
  });
});
