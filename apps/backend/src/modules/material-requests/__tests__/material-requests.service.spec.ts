import { MaterialRequestPriority, MaterialRequestStatus } from '@forethread/shared-types';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditAction, PoSourceOfCreation, UserRole } from '@prisma/client';

import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { PermissionsService } from '../../../common/permissions';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { InventoryService } from '../../inventory/inventory.service';
import {
  ConvertToPoDto,
  CreateMaterialRequestDto,
  UpdateMaterialRequestDto,
} from '../material-requests.dto';
import { MaterialRequestsService } from '../material-requests.service';

// ── Test users ────────────────────────────────────────────────────────────────
const officer: AuthenticatedUser = {
  id: 'po-1',
  email: 'po@example.com',
  role: UserRole.PROCUREMENT_OFFICER,
  companyId: 'company-1',
};
const foreman: AuthenticatedUser = {
  id: 'fm-1',
  email: 'fm@example.com',
  role: UserRole.FOREMAN,
  companyId: 'company-1',
};
const superAdmin: AuthenticatedUser = {
  id: 'sa-1',
  email: 'sa@example.com',
  role: UserRole.SUPER_ADMIN,
  companyId: null,
};

// ── Mock factory ────────────────────────────────────────────────────────────────
function makeService() {
  const tx = {
    rfq: { create: jest.fn().mockResolvedValue({ id: 'rfq-1', rfqNumber: 'RFQ-00001' }) },
    purchaseOrder: {
      create: jest.fn().mockResolvedValue({ id: 'po-9', poNumber: 'PO-00001' }),
    },
    materialRequest: { update: jest.fn().mockResolvedValue({}) },
    materialRequestLineItem: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };

  const prisma = {
    materialRequest: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'mr-1' }),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    rfq: { count: jest.fn().mockResolvedValue(0) },
    purchaseOrder: { count: jest.fn().mockResolvedValue(0) },
    project: { findUnique: jest.fn() },
    material: { findMany: jest.fn().mockResolvedValue([]) },
    projectLocation: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  } as unknown as PrismaService & {
    materialRequest: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    rfq: { count: jest.Mock };
    purchaseOrder: { count: jest.Mock };
    project: { findUnique: jest.Mock };
    material: { findMany: jest.Mock };
    projectLocation: { findMany: jest.Mock };
    auditLog: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const audit = { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService & {
    log: jest.Mock;
  };
  const permissions = {
    roleHasPermission: jest.fn().mockResolvedValue(false),
  } as unknown as PermissionsService & { roleHasPermission: jest.Mock };
  // Inventory push-out hook: defaults to "nothing in stock" (issued 0). Tests
  // that exercise auto-issue override issueOut per-call.
  const inventory = {
    issueOut: jest.fn().mockResolvedValue({ issued: 0, movement: null }),
  } as unknown as InventoryService & { issueOut: jest.Mock };

  const service = new MaterialRequestsService(prisma, audit, permissions, inventory);
  return { service, prisma, audit, permissions, inventory, tx };
}

// ── Fixture builders ──────────────────────────────────────────────────────────
function makeMr(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mr-1',
    mrNumber: 'MR-00001',
    status: MaterialRequestStatus.SUBMITTED,
    priority: 'MEDIUM',
    companyId: 'company-1',
    projectId: 'project-1',
    requestedById: 'fm-1',
    neededByDate: new Date('2026-07-01T00:00:00.000Z'),
    deliveryLocationId: null,
    note: null,
    reviewedById: null,
    reviewedAt: null,
    declineReason: null,
    convertedToRfqId: null,
    convertedToPoId: null,
    convertedAt: null,
    createdAt: new Date('2026-06-15T00:00:00.000Z'),
    updatedAt: new Date('2026-06-15T00:00:00.000Z'),
    project: { id: 'project-1', name: 'Downtown Reno' },
    company: { id: 'company-1', legalName: 'Acme Constructions' },
    requestedBy: { id: 'fm-1', name: 'Foreman Joe', email: 'fm@example.com' },
    reviewedBy: null,
    deliveryLocation: null,
    convertedToRfq: null,
    convertedToPo: null,
    lineItems: [
      {
        id: 'li-1',
        materialId: null,
        materialName: 'Steel Rebar #4',
        description: '20ft, Grade 60',
        quantity: 50,
        unit: 'pcs',
        priority: null,
        expectedDeliveryDate: null,
        deliveryLocationId: null,
        notes: null,
        material: null,
        deliveryLocation: null,
      },
    ],
    ...overrides,
  };
}

function makeCreateDto(
  overrides: Partial<CreateMaterialRequestDto> = {},
): CreateMaterialRequestDto {
  return {
    projectId: 'project-1',
    lineItems: [{ materialName: 'Steel Rebar #4', quantity: 50, unit: 'pcs' }],
    ...overrides,
  } as CreateMaterialRequestDto;
}

describe('MaterialRequestsService', () => {
  // ── create ──────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('creates a DRAFT MR, numbers it sequentially, and audits CREATED only', async () => {
      const { service, prisma, audit } = makeService();
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1', companyId: 'company-1' });
      prisma.materialRequest.count.mockResolvedValue(4); // → MR-00005
      prisma.materialRequest.create.mockResolvedValue({ id: 'mr-1' });
      prisma.materialRequest.findUnique.mockResolvedValue(makeMr());

      await service.create(foreman, makeCreateDto());

      const createArgs = prisma.materialRequest.create.mock.calls[0][0];
      expect(createArgs.data.mrNumber).toBe('MR-00005');
      expect(createArgs.data.status).toBe(MaterialRequestStatus.DRAFT);
      expect(createArgs.data.companyId).toBe('company-1');
      expect(createArgs.data.requestedById).toBe('fm-1');
      expect(createArgs.data.lineItems.create).toHaveLength(1);
      expect(audit.log).toHaveBeenCalledTimes(1);
      expect(audit.log.mock.calls[0][0].action).toBe(AuditAction.MATERIAL_REQUEST_CREATED);
    });

    it('creates straight in SUBMITTED and audits CREATED then SUBMITTED when submit=true', async () => {
      const { service, prisma, audit } = makeService();
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1', companyId: 'company-1' });
      prisma.materialRequest.create.mockResolvedValue({ id: 'mr-1' });
      prisma.materialRequest.findUnique.mockResolvedValue(makeMr());

      await service.create(
        foreman,
        makeCreateDto({
          submit: true,
          priority: MaterialRequestPriority.HIGH,
          neededByDate: '2026-07-02',
          note: 'urgent',
        }),
      );

      const createArgs = prisma.materialRequest.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe(MaterialRequestStatus.SUBMITTED);
      expect(createArgs.data.priority).toBe('HIGH');
      expect(createArgs.data.neededByDate).toBeInstanceOf(Date);
      expect(createArgs.data.note).toBe('urgent');
      expect(audit.log).toHaveBeenCalledTimes(2);
      expect(audit.log.mock.calls[1][0].action).toBe(AuditAction.MATERIAL_REQUEST_SUBMITTED);
    });

    it('throws NotFound when the project does not exist', async () => {
      const { service, prisma } = makeService();
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.create(foreman, makeCreateDto())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws Forbidden when the project belongs to another company', async () => {
      const { service, prisma } = makeService();
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1', companyId: 'other-co' });
      await expect(service.create(foreman, makeCreateDto())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects a line item with neither material id nor name', async () => {
      const { service, prisma } = makeService();
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1', companyId: 'company-1' });
      const dto = makeCreateDto({ lineItems: [{ quantity: 1, unit: 'pcs' }] as never });
      await expect(service.create(foreman, dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a catalogue material id that does not exist', async () => {
      const { service, prisma } = makeService();
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1', companyId: 'company-1' });
      prisma.material.findMany.mockResolvedValue([]); // none found
      const dto = makeCreateDto({
        lineItems: [{ materialId: 'mat-x', quantity: 1, unit: 'pcs' }] as never,
      });
      await expect(service.create(foreman, dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a valid catalogue material id', async () => {
      const { service, prisma } = makeService();
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1', companyId: 'company-1' });
      prisma.material.findMany.mockResolvedValue([{ id: 'mat-1' }]);
      prisma.materialRequest.create.mockResolvedValue({ id: 'mr-1' });
      prisma.materialRequest.findUnique.mockResolvedValue(makeMr());
      const dto = makeCreateDto({
        lineItems: [{ materialId: 'mat-1', quantity: 2, unit: 'pcs' }] as never,
      });
      await expect(service.create(foreman, dto)).resolves.toBeDefined();
    });

    it('rejects a delivery location outside the project', async () => {
      const { service, prisma } = makeService();
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1', companyId: 'company-1' });
      prisma.projectLocation.findMany.mockResolvedValue([
        { id: 'loc-1', projectId: 'another-project' },
      ]);
      const dto = makeCreateDto({ deliveryLocationId: 'loc-1' });
      await expect(service.create(foreman, dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts delivery locations that belong to the project', async () => {
      const { service, prisma } = makeService();
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1', companyId: 'company-1' });
      prisma.projectLocation.findMany.mockResolvedValue([{ id: 'loc-1', projectId: 'project-1' }]);
      prisma.materialRequest.create.mockResolvedValue({ id: 'mr-1' });
      prisma.materialRequest.findUnique.mockResolvedValue(makeMr());
      const dto = makeCreateDto({ deliveryLocationId: 'loc-1' });
      await expect(service.create(foreman, dto)).resolves.toBeDefined();
    });
  });

  // ── list ────────────────────────────────────────────────────────────────────
  describe('list', () => {
    it('returns an empty list for a non-super-admin with no company', async () => {
      const { service, prisma } = makeService();
      const result = await service.list({ ...foreman, companyId: null }, {});
      expect(result).toEqual({ items: [] });
      expect(prisma.materialRequest.findMany).not.toHaveBeenCalled();
    });

    it('scopes to company and applies mine/project/status/priority filters', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findMany.mockResolvedValue([]);
      await service.list(officer, {
        mine: true,
        projectId: 'project-1',
        status: MaterialRequestStatus.APPROVED,
        priority: MaterialRequestPriority.HIGH,
      });
      const where = prisma.materialRequest.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({
        companyId: 'company-1',
        requestedById: 'po-1',
        projectId: 'project-1',
        status: MaterialRequestStatus.APPROVED,
        priority: MaterialRequestPriority.HIGH,
      });
    });

    it('maps rows and applies the awaitingApproval + urgent quick filters', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findMany.mockResolvedValue([
        {
          id: 'mr-1',
          mrNumber: 'MR-00001',
          status: MaterialRequestStatus.SUBMITTED,
          priority: 'HIGH',
          neededByDate: new Date('2026-07-01T00:00:00.000Z'),
          createdAt: new Date('2026-06-15T00:00:00.000Z'),
          projectId: 'project-1',
          project: { id: 'project-1', name: 'Downtown Reno' },
          requestedBy: { id: 'fm-1', name: 'Foreman Joe' },
          _count: { lineItems: 3 },
        },
      ]);
      const result = await service.list(officer, { awaitingApproval: true, urgent: true });
      const where = prisma.materialRequest.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(MaterialRequestStatus.SUBMITTED);
      expect(where.priority).toEqual({ in: ['HIGH', 'URGENT'] });
      expect(result.items[0]).toMatchObject({
        id: 'mr-1',
        mrNumber: 'MR-00001',
        lineItemCount: 3,
        neededByDate: '2026-07-01T00:00:00.000Z',
      });
    });

    it('applies approved + overdue quick filters and skips company scope for super-admin', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findMany.mockResolvedValue([
        {
          id: 'mr-2',
          mrNumber: 'MR-00002',
          status: MaterialRequestStatus.APPROVED,
          priority: 'LOW',
          neededByDate: null,
          createdAt: new Date('2026-06-15T00:00:00.000Z'),
          projectId: 'project-1',
          project: { id: 'project-1', name: 'Downtown Reno' },
          requestedBy: { id: 'fm-1', name: 'Foreman Joe' },
          _count: { lineItems: 0 },
        },
      ]);
      const result = await service.list(superAdmin, { approved: true, overdue: true });
      const where = prisma.materialRequest.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBeUndefined();
      expect(where.neededByDate).toHaveProperty('lt');
      expect(where.status).toHaveProperty('notIn');
      expect(result.items[0].neededByDate).toBeNull();
    });
  });

  // ── get ─────────────────────────────────────────────────────────────────────
  describe('get', () => {
    it('throws NotFound when the MR is missing', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(null);
      await expect(service.get('mr-x', officer)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Forbidden when the MR belongs to another company', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(makeMr({ companyId: 'other-co' }));
      await expect(service.get('mr-1', officer)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('serialises a minimal MR (null review/conversion/location)', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(makeMr({ neededByDate: null }));
      const detail = await service.get('mr-1', officer);
      expect(detail.reviewedBy).toBeNull();
      expect(detail.deliveryLocation).toBeNull();
      expect(detail.convertedToRfq).toBeNull();
      expect(detail.convertedToPo).toBeNull();
      expect(detail.neededByDate).toBeNull();
      expect(detail.lineItems[0].materialName).toBe('Steel Rebar #4');
      expect(detail.lineItems[0].deliveryLocation).toBeNull();
    });

    it('serialises a fully-populated MR (review, conversions, location label/address)', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(
        makeMr({
          reviewedBy: { id: 'po-1', name: 'Officer Ann', email: 'po@example.com' },
          reviewedAt: new Date('2026-06-16T00:00:00.000Z'),
          deliveryLocation: { id: 'loc-1', label: 'HQ Yard', address: '1 St' },
          convertedToRfq: { id: 'rfq-1', rfqNumber: 'RFQ-00001' },
          convertedToPo: { id: 'po-9', poNumber: 'PO-00001' },
          convertedAt: new Date('2026-06-17T00:00:00.000Z'),
          lineItems: [
            {
              id: 'li-a',
              materialId: 'mat-1',
              materialName: 'fallback',
              description: 'd',
              quantity: 5,
              unit: 'pcs',
              priority: 'HIGH',
              expectedDeliveryDate: new Date('2026-07-01T00:00:00.000Z'),
              deliveryLocationId: 'loc-1',
              notes: 'n',
              material: { id: 'mat-1', name: 'Catalogue Steel', uom: 'pcs' },
              deliveryLocation: { id: 'loc-1', label: 'Bay 1', address: 'x' },
            },
            {
              id: 'li-b',
              materialId: null,
              materialName: 'Free Text Item',
              description: null,
              quantity: 2,
              unit: 'm',
              priority: null,
              expectedDeliveryDate: null,
              deliveryLocationId: 'loc-2',
              notes: null,
              material: null,
              deliveryLocation: { id: 'loc-2', label: null, address: '123 Main St' },
            },
          ],
        }),
      );
      const detail = await service.get('mr-1', officer);
      expect(detail.reviewedBy).toMatchObject({ name: 'Officer Ann' });
      expect(detail.deliveryLocation).toBe('HQ Yard');
      expect(detail.convertedToRfq).toMatchObject({ rfqNumber: 'RFQ-00001' });
      expect(detail.convertedToPo).toMatchObject({ poNumber: 'PO-00001' });
      // line A: catalogue material name + location label
      expect(detail.lineItems[0].materialName).toBe('Catalogue Steel');
      expect(detail.lineItems[0].deliveryLocation).toBe('Bay 1');
      // line B: free-text name + location address fallback
      expect(detail.lineItems[1].materialName).toBe('Free Text Item');
      expect(detail.lineItems[1].deliveryLocation).toBe('123 Main St');
    });

    it('allows a super-admin to read any company MR', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(makeMr({ companyId: 'other-co' }));
      await expect(service.get('mr-1', superAdmin)).resolves.toBeDefined();
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('throws NotFound when the MR is missing', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(null);
      await expect(service.update('mr-x', officer, {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects updating a non-DRAFT MR', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(
        makeMr({ status: MaterialRequestStatus.SUBMITTED }),
      );
      await expect(service.update('mr-1', officer, {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('replaces line items and patches header fields in a transaction', async () => {
      const { service, prisma, tx } = makeService();
      prisma.materialRequest.findUnique
        .mockResolvedValueOnce({
          id: 'mr-1',
          status: MaterialRequestStatus.DRAFT,
          companyId: 'company-1',
          projectId: 'project-1',
        })
        .mockResolvedValueOnce(makeMr({ status: MaterialRequestStatus.DRAFT }));
      const dto: UpdateMaterialRequestDto = {
        priority: 'URGENT',
        note: 'rev',
        neededByDate: '2026-08-01',
        deliveryLocationId: 'loc-1',
        lineItems: [{ materialName: 'New', quantity: 9, unit: 'kg' }],
      } as UpdateMaterialRequestDto;
      prisma.projectLocation.findMany.mockResolvedValue([{ id: 'loc-1', projectId: 'project-1' }]);

      await service.update('mr-1', officer, dto);

      expect(tx.materialRequestLineItem.deleteMany).toHaveBeenCalledWith({
        where: { materialRequestId: 'mr-1' },
      });
      expect(tx.materialRequestLineItem.createMany).toHaveBeenCalled();
      const updateArgs = tx.materialRequest.update.mock.calls[0][0];
      expect(updateArgs.data.priority).toBe('URGENT');
      expect(updateArgs.data.note).toBe('rev');
      expect(updateArgs.data.neededByDate).toBeInstanceOf(Date);
      expect(updateArgs.data.deliveryLocation).toEqual({ connect: { id: 'loc-1' } });
    });

    it('clears needed-by date and disconnects the delivery location when nulled', async () => {
      const { service, prisma, tx } = makeService();
      prisma.materialRequest.findUnique
        .mockResolvedValueOnce({
          id: 'mr-1',
          status: MaterialRequestStatus.DRAFT,
          companyId: 'company-1',
          projectId: 'project-1',
        })
        .mockResolvedValueOnce(makeMr({ status: MaterialRequestStatus.DRAFT }));

      await service.update('mr-1', officer, {
        neededByDate: null,
        deliveryLocationId: null,
      } as unknown as UpdateMaterialRequestDto);

      const updateArgs = tx.materialRequest.update.mock.calls[0][0];
      expect(updateArgs.data.neededByDate).toBeNull();
      expect(updateArgs.data.deliveryLocation).toEqual({ disconnect: true });
      expect(tx.materialRequestLineItem.deleteMany).not.toHaveBeenCalled();
    });
  });

  // ── submit ──────────────────────────────────────────────────────────────────
  describe('submit', () => {
    it('moves DRAFT → SUBMITTED and audits', async () => {
      const { service, prisma, audit } = makeService();
      prisma.materialRequest.findUnique
        .mockResolvedValueOnce({
          id: 'mr-1',
          status: MaterialRequestStatus.DRAFT,
          companyId: 'company-1',
          requestedById: 'fm-1',
        })
        .mockResolvedValueOnce(makeMr());
      await service.submit('mr-1', foreman);
      expect(prisma.materialRequest.update).toHaveBeenCalledWith({
        where: { id: 'mr-1' },
        data: { status: MaterialRequestStatus.SUBMITTED },
      });
      expect(audit.log.mock.calls[0][0].action).toBe(AuditAction.MATERIAL_REQUEST_SUBMITTED);
    });

    it('rejects submitting a non-DRAFT MR via the state machine', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue({
        id: 'mr-1',
        status: MaterialRequestStatus.APPROVED,
        companyId: 'company-1',
        requestedById: 'fm-1',
      });
      await expect(service.submit('mr-1', foreman)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound for a missing MR', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(null);
      await expect(service.submit('mr-x', foreman)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('still resolves when the audit write fails (best-effort)', async () => {
      const { service, prisma, audit } = makeService();
      prisma.materialRequest.findUnique
        .mockResolvedValueOnce({
          id: 'mr-1',
          status: MaterialRequestStatus.DRAFT,
          companyId: 'company-1',
          requestedById: 'fm-1',
        })
        .mockResolvedValueOnce(makeMr());
      audit.log.mockRejectedValueOnce(new Error('audit down'));
      await expect(service.submit('mr-1', foreman)).resolves.toBeDefined();
    });
  });

  // ── approve ─────────────────────────────────────────────────────────────────
  describe('approve', () => {
    it('moves SUBMITTED → APPROVED, records reviewer, audits', async () => {
      const { service, prisma, audit, tx } = makeService();
      prisma.materialRequest.findUnique
        .mockResolvedValueOnce({
          id: 'mr-1',
          status: MaterialRequestStatus.SUBMITTED,
          companyId: 'company-1',
          deliveryLocationId: null,
          lineItems: [],
        })
        .mockResolvedValueOnce(makeMr({ status: MaterialRequestStatus.APPROVED }));
      await service.approve('mr-1', officer);
      // The MR update now runs inside the approve $transaction (tx client).
      const updateArgs = tx.materialRequest.update.mock.calls[0][0];
      expect(updateArgs.data.status).toBe(MaterialRequestStatus.APPROVED);
      expect(updateArgs.data.reviewedById).toBe('po-1');
      expect(updateArgs.data.reviewedAt).toBeInstanceOf(Date);
      expect(audit.log.mock.calls[0][0].action).toBe(AuditAction.MATERIAL_REQUEST_APPROVED);
      // No catalogue/located lines ⇒ no auto-issue and an empty issued summary.
      expect(audit.log.mock.calls[0][0].metadata.issued).toEqual([]);
    });

    it('auto-issues in-stock lines (OUT movement) and records them in the audit summary', async () => {
      const { service, prisma, inventory, audit } = makeService();
      prisma.materialRequest.findUnique
        .mockResolvedValueOnce({
          id: 'mr-1',
          status: MaterialRequestStatus.SUBMITTED,
          companyId: 'company-1',
          deliveryLocationId: 'loc-hdr',
          lineItems: [
            // tracked: material + line location → issued from stock
            {
              id: 'li-1',
              materialId: 'mat-1',
              quantity: 30,
              deliveryLocationId: 'loc-1',
            },
            // tracked: material + falls back to header location, but no stock
            { id: 'li-2', materialId: 'mat-2', quantity: 10, deliveryLocationId: null },
            // untracked: no material → skipped entirely (issueOut not called)
            { id: 'li-3', materialId: null, quantity: 5, deliveryLocationId: 'loc-1' },
          ],
        })
        .mockResolvedValueOnce(makeMr({ status: MaterialRequestStatus.APPROVED }));
      inventory.issueOut
        .mockResolvedValueOnce({ issued: 20, movement: { id: 'mov-1' } }) // li-1 clamped
        .mockResolvedValueOnce({ issued: 0, movement: null }); // li-2 no stock

      await service.approve('mr-1', officer);

      // Only the two material-bearing lines reached issueOut; the no-material
      // line was skipped before the call.
      expect(inventory.issueOut).toHaveBeenCalledTimes(2);
      expect(inventory.issueOut.mock.calls[0][1]).toMatchObject({
        companyId: 'company-1',
        materialId: 'mat-1',
        locationId: 'loc-1',
        requestedQuantity: 30,
        sourceType: 'MATERIAL_REQUEST',
        sourceId: 'mr-1',
        sourceLineId: 'li-1',
        createdById: 'po-1',
      });
      // li-2 falls back to the header location.
      expect(inventory.issueOut.mock.calls[1][1]).toMatchObject({
        materialId: 'mat-2',
        locationId: 'loc-hdr',
      });
      // Only the line that actually issued (>0) shows in the audit summary.
      expect(audit.log.mock.calls[0][0].metadata.issued).toEqual([
        { lineId: 'li-1', materialId: 'mat-1', locationId: 'loc-1', issued: 20 },
      ]);
    });

    it('rejects approving a DRAFT MR', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue({
        id: 'mr-1',
        status: MaterialRequestStatus.DRAFT,
        companyId: 'company-1',
        deliveryLocationId: null,
        lineItems: [],
      });
      await expect(service.approve('mr-1', officer)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound when the MR is missing', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(null);
      await expect(service.approve('mr-x', officer)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Forbidden when the MR belongs to another company', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue({
        id: 'mr-1',
        status: MaterialRequestStatus.SUBMITTED,
        companyId: 'other-co',
        deliveryLocationId: null,
        lineItems: [],
      });
      await expect(service.approve('mr-1', officer)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── decline ─────────────────────────────────────────────────────────────────
  describe('decline', () => {
    it('moves SUBMITTED → DECLINED, persists the reason, audits with reason', async () => {
      const { service, prisma, audit } = makeService();
      prisma.materialRequest.findUnique
        .mockResolvedValueOnce({
          id: 'mr-1',
          status: MaterialRequestStatus.SUBMITTED,
          companyId: 'company-1',
          requestedById: 'fm-1',
        })
        .mockResolvedValueOnce(makeMr({ status: MaterialRequestStatus.DECLINED }));
      await service.decline('mr-1', officer, { reason: 'Out of budget' });
      const updateArgs = prisma.materialRequest.update.mock.calls[0][0];
      expect(updateArgs.data.status).toBe(MaterialRequestStatus.DECLINED);
      expect(updateArgs.data.declineReason).toBe('Out of budget');
      expect(audit.log.mock.calls[0][0].metadata).toMatchObject({ reason: 'Out of budget' });
    });

    it('rejects declining an APPROVED MR', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue({
        id: 'mr-1',
        status: MaterialRequestStatus.APPROVED,
        companyId: 'company-1',
        requestedById: 'fm-1',
      });
      await expect(service.decline('mr-1', officer, { reason: 'x' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  // ── cancel ──────────────────────────────────────────────────────────────────
  describe('cancel', () => {
    it('lets the requester cancel their own DRAFT MR', async () => {
      const { service, prisma, audit } = makeService();
      prisma.materialRequest.findUnique
        .mockResolvedValueOnce({
          id: 'mr-1',
          status: MaterialRequestStatus.DRAFT,
          companyId: 'company-1',
          requestedById: 'fm-1',
        })
        .mockResolvedValueOnce(makeMr({ status: MaterialRequestStatus.CANCELLED }));
      await service.cancel('mr-1', foreman);
      expect(prisma.materialRequest.update).toHaveBeenCalledWith({
        where: { id: 'mr-1' },
        data: { status: MaterialRequestStatus.CANCELLED },
      });
      expect(audit.log.mock.calls[0][0].action).toBe(AuditAction.MATERIAL_REQUEST_CANCELLED);
    });

    it('lets an entitled approver cancel another user’s MR', async () => {
      const { service, prisma, permissions } = makeService();
      permissions.roleHasPermission.mockResolvedValue(true);
      prisma.materialRequest.findUnique
        .mockResolvedValueOnce({
          id: 'mr-1',
          status: MaterialRequestStatus.SUBMITTED,
          companyId: 'company-1',
          requestedById: 'someone-else',
        })
        .mockResolvedValueOnce(makeMr({ status: MaterialRequestStatus.CANCELLED }));
      await expect(service.cancel('mr-1', officer)).resolves.toBeDefined();
      expect(permissions.roleHasPermission).toHaveBeenCalledWith(
        UserRole.PROCUREMENT_OFFICER,
        'materialRequest.approve',
      );
    });

    it('lets a super-admin cancel without an explicit grant lookup', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.materialRequest.findUnique
        .mockResolvedValueOnce({
          id: 'mr-1',
          status: MaterialRequestStatus.SUBMITTED,
          companyId: 'company-1',
          requestedById: 'someone-else',
        })
        .mockResolvedValueOnce(makeMr({ status: MaterialRequestStatus.CANCELLED }));
      await expect(service.cancel('mr-1', superAdmin)).resolves.toBeDefined();
      expect(permissions.roleHasPermission).not.toHaveBeenCalled();
    });

    it('forbids a non-requester without the approve grant', async () => {
      const { service, prisma, permissions } = makeService();
      permissions.roleHasPermission.mockResolvedValue(false);
      prisma.materialRequest.findUnique.mockResolvedValue({
        id: 'mr-1',
        status: MaterialRequestStatus.SUBMITTED,
        companyId: 'company-1',
        requestedById: 'someone-else',
      });
      await expect(service.cancel('mr-1', officer)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects cancelling an MR already in a terminal state', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue({
        id: 'mr-1',
        status: MaterialRequestStatus.CONVERTED,
        companyId: 'company-1',
        requestedById: 'fm-1',
      });
      await expect(service.cancel('mr-1', foreman)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── convertToRfq ──────────────────────────────────────────────────────────────
  describe('convertToRfq', () => {
    it('creates a draft RFQ from an APPROVED MR, links it, and audits', async () => {
      const { service, prisma, tx, audit } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(
        makeMr({ status: MaterialRequestStatus.APPROVED }),
      );
      const result = await service.convertToRfq('mr-1', officer, { name: 'From MR' });
      expect(result).toEqual({ rfqId: 'rfq-1', rfqNumber: 'RFQ-00001' });
      const rfqArgs = tx.rfq.create.mock.calls[0][0];
      expect(rfqArgs.data.name).toBe('From MR');
      expect(rfqArgs.data.totalRequestedQty).toBe(50);
      expect(rfqArgs.data.lineItems.create).toHaveLength(1);
      expect(tx.materialRequest.update).toHaveBeenCalledWith({
        where: { id: 'mr-1' },
        data: expect.objectContaining({
          status: MaterialRequestStatus.CONVERTED,
          convertedToRfqId: 'rfq-1',
        }),
      });
      expect(audit.log.mock.calls[0][0].action).toBe(AuditAction.MATERIAL_REQUEST_CONVERTED);
      expect(audit.log.mock.calls[0][0].metadata).toMatchObject({ target: 'RFQ', rfqId: 'rfq-1' });
    });

    it('defaults the RFQ name to null when not supplied', async () => {
      const { service, prisma, tx } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(
        makeMr({ status: MaterialRequestStatus.APPROVED }),
      );
      await service.convertToRfq('mr-1', officer);
      expect(tx.rfq.create.mock.calls[0][0].data.name).toBeNull();
    });

    it('throws NotFound for a missing MR', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(null);
      await expect(service.convertToRfq('mr-x', officer)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Forbidden for another company’s MR', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(
        makeMr({ status: MaterialRequestStatus.APPROVED, companyId: 'other-co' }),
      );
      await expect(service.convertToRfq('mr-1', officer)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects converting an MR that is not APPROVED', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(
        makeMr({ status: MaterialRequestStatus.SUBMITTED }),
      );
      await expect(service.convertToRfq('mr-1', officer)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  // ── convertToPo ───────────────────────────────────────────────────────────────
  describe('convertToPo', () => {
    it('creates a draft PO (source=MATERIAL_REQUEST) from an APPROVED MR, links it, audits', async () => {
      const { service, prisma, tx, audit } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(
        makeMr({ status: MaterialRequestStatus.APPROVED }),
      );
      const result = await service.convertToPo('mr-1', officer, { vendorId: 'vendor-1' });
      expect(result).toEqual({ poId: 'po-9', poNumber: 'PO-00001' });
      const poArgs = tx.purchaseOrder.create.mock.calls[0][0];
      expect(poArgs.data.sourceOfCreation).toBe(PoSourceOfCreation.MATERIAL_REQUEST);
      expect(poArgs.data.vendorId).toBe('vendor-1');
      expect(poArgs.data.lineItems.create[0].quantityOrdered).toBe(50);
      // description falls back to the material name when no description present
      expect(poArgs.data.lineItems.create[0].description).toBe('20ft, Grade 60');
      expect(tx.materialRequest.update).toHaveBeenCalledWith({
        where: { id: 'mr-1' },
        data: expect.objectContaining({
          status: MaterialRequestStatus.CONVERTED,
          convertedToPoId: 'po-9',
        }),
      });
      expect(audit.log.mock.calls[0][0].metadata).toMatchObject({ target: 'PO', poId: 'po-9' });
    });

    it('falls back to the material name for the PO line description', async () => {
      const { service, prisma, tx } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(
        makeMr({
          status: MaterialRequestStatus.APPROVED,
          lineItems: [
            {
              id: 'li-1',
              materialId: null,
              materialName: 'Galvanised Bolts',
              description: null,
              quantity: 10,
              unit: 'box',
              priority: null,
              expectedDeliveryDate: null,
              deliveryLocationId: null,
              notes: null,
            },
          ],
        }),
      );
      await service.convertToPo('mr-1', officer, { vendorId: 'vendor-1' });
      expect(tx.purchaseOrder.create.mock.calls[0][0].data.lineItems.create[0].description).toBe(
        'Galvanised Bolts',
      );
    });

    it('rejects a missing vendor id', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(
        makeMr({ status: MaterialRequestStatus.APPROVED }),
      );
      await expect(
        service.convertToPo('mr-1', officer, { vendorId: '' } as ConvertToPoDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects converting an MR that is not APPROVED', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(
        makeMr({ status: MaterialRequestStatus.DRAFT }),
      );
      await expect(
        service.convertToPo('mr-1', officer, { vendorId: 'vendor-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound for a missing MR', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(null);
      await expect(
        service.convertToPo('mr-x', officer, { vendorId: 'vendor-1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── getAuditTrail ──────────────────────────────────────────────────────────────
  describe('getAuditTrail', () => {
    it('throws NotFound for a missing MR', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue(null);
      await expect(service.getAuditTrail('mr-x', officer)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws Forbidden for another company’s MR', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue({ id: 'mr-1', companyId: 'other-co' });
      await expect(service.getAuditTrail('mr-1', officer)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('maps audit rows oldest-first, resolving the performer (and null performer)', async () => {
      const { service, prisma } = makeService();
      prisma.materialRequest.findUnique.mockResolvedValue({ id: 'mr-1', companyId: 'company-1' });
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          action: AuditAction.MATERIAL_REQUEST_CREATED,
          metadata: {},
          createdAt: new Date('2026-06-15T00:00:00.000Z'),
          performedBy: { id: 'fm-1', name: 'Foreman Joe', email: 'fm@example.com' },
        },
        {
          id: 'log-2',
          action: AuditAction.MATERIAL_REQUEST_SUBMITTED,
          metadata: { from: 'DRAFT', to: 'SUBMITTED' },
          createdAt: new Date('2026-06-15T01:00:00.000Z'),
          performedBy: null,
        },
      ]);
      const trail = await service.getAuditTrail('mr-1', officer);
      expect(trail).toHaveLength(2);
      expect(trail[0]).toMatchObject({
        id: 'log-1',
        action: AuditAction.MATERIAL_REQUEST_CREATED,
        performedBy: { name: 'Foreman Joe' },
        createdAt: '2026-06-15T00:00:00.000Z',
      });
      expect(trail[1].performedBy).toBeNull();
    });
  });
});
