import { CreateBomDto, UpdateBomDto } from '@forethread/shared-types';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BomStatus, UserRole } from '@prisma/client';

import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { BomsService } from '../boms.service';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'po@example.com',
  role: UserRole.PROCUREMENT_OFFICER,
  companyId: 'company-1',
};

const companylessUser: AuthenticatedUser = { ...user, companyId: null };

function makeDto(overrides: Partial<CreateBomDto> = {}): CreateBomDto {
  return {
    projectId: 'project-1',
    extractionId: 'extraction-1',
    items: [
      {
        materialName: 'Portland Cement Type I',
        matchedMaterialId: 'mat-1',
        description: 'Cement 25kg bag',
        uom: 'bag',
        quantity: 50,
        matchConfidence: 0.86,
      },
      {
        materialName: 'Hydraulic Lime Binder',
        matchedMaterialId: 'mat-2',
        uom: 'kg',
        quantity: 12,
      },
    ],
    ...overrides,
  } as CreateBomDto;
}

function makeUpdateDto(overrides: Partial<UpdateBomDto> = {}): UpdateBomDto {
  return {
    items: [
      {
        materialName: 'Portland Cement Type I',
        matchedMaterialId: 'mat-1',
        uom: 'bag',
        quantity: 75,
      },
      {
        materialName: 'Reinforcing Bar 12mm',
        matchedMaterialId: 'mat-3',
        quantity: 200,
      },
    ],
    ...overrides,
  } as UpdateBomDto;
}

function makeService() {
  const tx = {
    bom: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(),
      update: jest.fn(),
    },
    bomItem: {
      deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
  };
  const prisma = {
    project: { findFirst: jest.fn() },
    material: { count: jest.fn() },
    bom: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
  } as unknown as PrismaService & {
    project: { findFirst: jest.Mock };
    material: { count: jest.Mock };
    bom: { count: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  const materials = {
    recordMaterialUsage: jest.fn().mockResolvedValue(undefined),
  };

  const service = new BomsService(prisma, materials as never);
  return { service, prisma, tx, materials };
}

describe('BomsService', () => {
  describe('createBom', () => {
    it('creates the BOM, numbers it sequentially, and supersedes the previous active BOM', async () => {
      const { service, prisma, tx, materials } = makeService();
      prisma.project.findFirst.mockResolvedValue({ id: 'project-1' });
      prisma.material.count.mockResolvedValue(2);
      prisma.bom.count.mockResolvedValue(7);
      const created = { id: 'bom-1' };
      tx.bom.create.mockResolvedValue(created);

      const result = await service.createBom(makeDto(), user);

      expect(result).toBe(created);
      // Per-user usage signal recorded for the matched materials (US 4.04).
      expect(materials.recordMaterialUsage).toHaveBeenCalledWith('user-1', ['mat-1', 'mat-2']);
      expect(tx.bom.updateMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1', status: BomStatus.ACTIVE },
        data: { status: BomStatus.SUPERSEDED },
      });
      const createArgs = tx.bom.create.mock.calls[0][0];
      expect(createArgs.data.bomNumber).toBe('BOM-00008');
      expect(createArgs.data.companyId).toBe('company-1');
      expect(createArgs.data.extractionId).toBe('extraction-1');
      expect(createArgs.data.items.create).toHaveLength(2);
      // sortOrder defaults to the array position when not supplied.
      expect(createArgs.data.items.create[1].sortOrder).toBe(1);
    });

    it('rejects a project outside the user company', async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.createBom(makeDto(), user)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.project.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'project-1', companyId: 'company-1' } }),
      );
    });

    it('rejects items referencing unknown materials', async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue({ id: 'project-1' });
      prisma.material.count.mockResolvedValue(1); // dto references 2 distinct materials

      await expect(service.createBom(makeDto(), user)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects users without a company', async () => {
      const { service } = makeService();
      await expect(service.createBom(makeDto(), companylessUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('updateBom', () => {
    it('replaces all items in place (delete + recreate), preserves sortOrder, and touches updatedAt', async () => {
      const { service, prisma, tx } = makeService();
      prisma.bom.findFirst.mockResolvedValue({ id: 'bom-1' });
      prisma.material.count.mockResolvedValue(2);
      const updated = { id: 'bom-1' };
      tx.bom.update.mockResolvedValue(updated);

      const result = await service.updateBom('bom-1', makeUpdateDto(), user);

      expect(result).toBe(updated);
      // Old lines wiped, new ones recreated — no new BOM, no supersede.
      expect(tx.bomItem.deleteMany).toHaveBeenCalledWith({ where: { bomId: 'bom-1' } });
      expect(tx.bom.create).not.toHaveBeenCalled();
      expect(tx.bom.updateMany).not.toHaveBeenCalled();
      const createArgs = tx.bomItem.createMany.mock.calls[0][0];
      expect(createArgs.data).toHaveLength(2);
      expect(createArgs.data[0]).toMatchObject({ bomId: 'bom-1', sortOrder: 0 });
      // sortOrder defaults to the array position when not supplied.
      expect(createArgs.data[1].sortOrder).toBe(1);
      // updatedAt is bumped on the parent (createMany/deleteMany don't).
      const updateArgs = tx.bom.update.mock.calls[0][0];
      expect(updateArgs.where).toEqual({ id: 'bom-1' });
      expect(updateArgs.data.updatedAt).toBeInstanceOf(Date);
    });

    it('honours an explicitly supplied sortOrder', async () => {
      const { service, prisma, tx } = makeService();
      prisma.bom.findFirst.mockResolvedValue({ id: 'bom-1' });
      prisma.material.count.mockResolvedValue(1);
      tx.bom.update.mockResolvedValue({ id: 'bom-1' });

      await service.updateBom(
        'bom-1',
        makeUpdateDto({
          items: [{ materialName: 'Cement', matchedMaterialId: 'mat-1', sortOrder: 5 }],
        }),
        user,
      );

      const createArgs = tx.bomItem.createMany.mock.calls[0][0];
      expect(createArgs.data[0].sortOrder).toBe(5);
    });

    it('allows clearing all lines (empty items): deletes, skips recreate and the material check', async () => {
      const { service, prisma, tx } = makeService();
      prisma.bom.findFirst.mockResolvedValue({ id: 'bom-1' });
      tx.bom.update.mockResolvedValue({ id: 'bom-1' });

      await service.updateBom('bom-1', makeUpdateDto({ items: [] }), user);

      expect(tx.bomItem.deleteMany).toHaveBeenCalledWith({ where: { bomId: 'bom-1' } });
      expect(tx.bomItem.createMany).not.toHaveBeenCalled();
      // No materials referenced ⇒ the catalogue validation query is skipped.
      expect(prisma.material.count).not.toHaveBeenCalled();
      expect(tx.bom.update).toHaveBeenCalled();
    });

    it('404s on a BOM from another company (and does not mutate)', async () => {
      const { service, prisma, tx } = makeService();
      prisma.bom.findFirst.mockResolvedValue(null);

      await expect(service.updateBom('bom-1', makeUpdateDto(), user)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.bom.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'bom-1', companyId: 'company-1' } }),
      );
      expect(tx.bomItem.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects items referencing unknown materials', async () => {
      const { service, prisma, tx } = makeService();
      prisma.bom.findFirst.mockResolvedValue({ id: 'bom-1' });
      prisma.material.count.mockResolvedValue(1); // dto references 2 distinct materials

      await expect(service.updateBom('bom-1', makeUpdateDto(), user)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tx.bomItem.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects users without a company', async () => {
      const { service } = makeService();
      await expect(
        service.updateBom('bom-1', makeUpdateDto(), companylessUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('listBoms', () => {
    it('scopes the list to the user company and optional project', async () => {
      const { service, prisma } = makeService();
      await service.listBoms('project-9', user);

      expect(prisma.bom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'company-1', projectId: 'project-9' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('omits the project filter when not provided', async () => {
      const { service, prisma } = makeService();
      await service.listBoms(undefined, user);

      expect(prisma.bom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'company-1' } }),
      );
    });
  });

  describe('getBom', () => {
    it('returns the BOM when it belongs to the company', async () => {
      const { service, prisma } = makeService();
      const bom = { id: 'bom-1' };
      prisma.bom.findFirst.mockResolvedValue(bom);

      await expect(service.getBom('bom-1', user)).resolves.toBe(bom);
      expect(prisma.bom.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'bom-1', companyId: 'company-1' } }),
      );
    });

    it('404s on a BOM from another company', async () => {
      const { service, prisma } = makeService();
      prisma.bom.findFirst.mockResolvedValue(null);

      await expect(service.getBom('bom-1', user)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
