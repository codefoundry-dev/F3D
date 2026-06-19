import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MaterialStatus, UserRole } from '@prisma/client';

import { MaterialListsService } from '../material-lists.service';

const mockPrisma = {
  materialList: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  materialListItem: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  material: {
    findMany: jest.fn(),
  },
};

const mockMaterials = {
  recordMaterialUsage: jest.fn().mockResolvedValue(undefined),
};

const companyAdmin = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};

const noCompanyUser = {
  id: 'sa-1',
  email: 'sa@test.com',
  role: UserRole.SUPER_ADMIN,
  companyId: null,
};

const listDetailRow = {
  id: 'list-1',
  name: 'My List',
  description: 'desc',
  items: [
    {
      id: 'item-1',
      quantity: 1,
      material: {
        id: 'm-1',
        name: 'Cable',
        uom: 'm',
        manufacturer: 'Acme',
        description: 'A cable',
        status: MaterialStatus.PUBLIC,
        materialType: 'Electrical',
        upc: 'UPC-1',
        pricePerUnit: null,
        currency: 'AUD',
        imageUrl: null,
        updatedAt: new Date('2026-06-13T10:00:00Z'),
        category: { id: 'cat-1', name: 'Electrical' },
      },
    },
  ],
};

describe('MaterialListsService (CRUD — US 4.03)', () => {
  let service: MaterialListsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MaterialListsService(mockPrisma as never, mockMaterials as never);
  });

  // ── createList ─────────────────────────────────────────────────────────────

  describe('createList', () => {
    it('creates a company-scoped list owned by the caller', async () => {
      mockPrisma.materialList.create.mockResolvedValue({
        id: 'list-1',
        name: 'My List',
        description: 'desc',
        updatedAt: new Date('2026-06-13T10:00:00Z'),
        _count: { items: 0 },
      });

      const res = await service.createList(
        { name: 'My List', description: 'desc' } as never,
        companyAdmin,
      );

      const data = mockPrisma.materialList.create.mock.calls[0][0].data;
      expect(data.companyId).toBe('comp-1');
      expect(data.createdById).toBe('ca-1');
      expect(data.name).toBe('My List');
      expect(data.description).toBe('desc');
      expect(res).toEqual({
        id: 'list-1',
        name: 'My List',
        description: 'desc',
        itemCount: 0,
        updatedAt: '2026-06-13T10:00:00.000Z',
      });
    });

    it('defaults a missing description to null', async () => {
      mockPrisma.materialList.create.mockResolvedValue({
        id: 'list-2',
        name: 'X',
        description: null,
        updatedAt: new Date('2026-06-13T10:00:00Z'),
        _count: { items: 0 },
      });

      await service.createList({ name: 'X' } as never, companyAdmin);

      const data = mockPrisma.materialList.create.mock.calls[0][0].data;
      expect(data.description).toBeNull();
    });

    it('throws Forbidden when the user has no company', async () => {
      await expect(service.createList({ name: 'X' } as never, noCompanyUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.materialList.create).not.toHaveBeenCalled();
    });
  });

  // ── updateList ─────────────────────────────────────────────────────────────

  describe('updateList', () => {
    it('updates only the supplied fields of a company-owned list', async () => {
      mockPrisma.materialList.findFirst.mockResolvedValue({ id: 'list-1' });
      mockPrisma.materialList.update.mockResolvedValue({
        id: 'list-1',
        name: 'Renamed',
        description: 'desc',
        updatedAt: new Date('2026-06-13T11:00:00Z'),
        _count: { items: 2 },
      });

      const res = await service.updateList('list-1', { name: 'Renamed' } as never, companyAdmin);

      // Ownership guard scoped to the company.
      expect(mockPrisma.materialList.findFirst).toHaveBeenCalledWith({
        where: { id: 'list-1', companyId: 'comp-1' },
        select: { id: true },
      });
      const data = mockPrisma.materialList.update.mock.calls[0][0].data;
      expect(data).toEqual({ name: 'Renamed' });
      expect(res.itemCount).toBe(2);
    });

    it('404s when the list belongs to another company (or is missing)', async () => {
      mockPrisma.materialList.findFirst.mockResolvedValue(null);
      await expect(
        service.updateList('list-x', { name: 'Y' } as never, companyAdmin),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.materialList.update).not.toHaveBeenCalled();
    });
  });

  // ── deleteList ─────────────────────────────────────────────────────────────

  describe('deleteList', () => {
    it('deletes a company-owned list (items cascade)', async () => {
      mockPrisma.materialList.findFirst.mockResolvedValue({ id: 'list-1' });
      mockPrisma.materialList.delete.mockResolvedValue({});

      const res = await service.deleteList('list-1', companyAdmin);

      expect(mockPrisma.materialList.delete).toHaveBeenCalledWith({ where: { id: 'list-1' } });
      expect(res).toEqual({ success: true });
    });

    it('404s when deleting a list outside the company', async () => {
      mockPrisma.materialList.findFirst.mockResolvedValue(null);
      await expect(service.deleteList('list-x', companyAdmin)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.materialList.delete).not.toHaveBeenCalled();
    });
  });

  // ── addItems ───────────────────────────────────────────────────────────────

  describe('addItems', () => {
    beforeEach(() => {
      mockPrisma.materialList.update.mockResolvedValue({});
    });

    it('validates visibility, createMany with skipDuplicates, bumps updatedAt, returns detail', async () => {
      // First findFirst = ownership guard; later findFirst = detail re-fetch.
      mockPrisma.materialList.findFirst
        .mockReset()
        .mockResolvedValueOnce({ id: 'list-1' })
        .mockResolvedValueOnce(listDetailRow);
      mockPrisma.material.findMany.mockResolvedValue([{ id: 'm-1' }, { id: 'm-2' }]);
      mockPrisma.materialListItem.createMany.mockResolvedValue({ count: 2 });

      const res = await service.addItems(
        'list-1',
        { materialIds: ['m-1', 'm-2'] } as never,
        companyAdmin,
      );

      // Visibility query scoped to public OR own company.
      const visWhere = mockPrisma.material.findMany.mock.calls[0][0].where;
      expect(visWhere.OR).toEqual([{ status: MaterialStatus.PUBLIC }, { companyId: 'comp-1' }]);
      // createMany with skipDuplicates.
      expect(mockPrisma.materialListItem.createMany).toHaveBeenCalledWith({
        data: [
          { listId: 'list-1', materialId: 'm-1' },
          { listId: 'list-1', materialId: 'm-2' },
        ],
        skipDuplicates: true,
      });
      // updatedAt bumped.
      expect(mockPrisma.materialList.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'list-1' } }),
      );
      // Per-user usage signal recorded for the added materials (US 4.04).
      expect(mockMaterials.recordMaterialUsage).toHaveBeenCalledWith('ca-1', ['m-1', 'm-2']);
      expect(res.id).toBe('list-1');
      expect(res.items).toHaveLength(1);
    });

    it('de-duplicates input ids before the visibility count check', async () => {
      mockPrisma.materialList.findFirst
        .mockReset()
        .mockResolvedValueOnce({ id: 'list-1' })
        .mockResolvedValueOnce(listDetailRow);
      mockPrisma.material.findMany.mockResolvedValue([{ id: 'm-1' }]);
      mockPrisma.materialListItem.createMany.mockResolvedValue({ count: 1 });

      await service.addItems('list-1', { materialIds: ['m-1', 'm-1'] } as never, companyAdmin);

      // Only the distinct id is created — the duplicate input does not fail the
      // count check (1 visible === 1 distinct).
      expect(mockPrisma.materialListItem.createMany).toHaveBeenCalledWith({
        data: [{ listId: 'list-1', materialId: 'm-1' }],
        skipDuplicates: true,
      });
    });

    it('rejects when a material id is not visible to the company', async () => {
      mockPrisma.materialList.findFirst.mockReset().mockResolvedValueOnce({ id: 'list-1' });
      // Only one of the two requested ids resolves as visible.
      mockPrisma.material.findMany.mockResolvedValue([{ id: 'm-1' }]);

      await expect(
        service.addItems('list-1', { materialIds: ['m-1', 'm-hidden'] } as never, companyAdmin),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.materialListItem.createMany).not.toHaveBeenCalled();
    });

    it('404s when the list is not in the company', async () => {
      mockPrisma.materialList.findFirst.mockReset().mockResolvedValueOnce(null);
      await expect(
        service.addItems('list-x', { materialIds: ['m-1'] } as never, companyAdmin),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.material.findMany).not.toHaveBeenCalled();
    });
  });

  // ── removeItem ─────────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('deletes an item scoped to the parent list and returns the refreshed detail', async () => {
      mockPrisma.materialList.findFirst
        .mockReset()
        .mockResolvedValueOnce({ id: 'list-1' })
        .mockResolvedValueOnce(listDetailRow);
      mockPrisma.materialListItem.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.materialList.update.mockResolvedValue({});

      const res = await service.removeItem('list-1', 'item-1', companyAdmin);

      expect(mockPrisma.materialListItem.deleteMany).toHaveBeenCalledWith({
        where: { id: 'item-1', listId: 'list-1' },
      });
      expect(mockPrisma.materialList.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'list-1' } }),
      );
      expect(res.id).toBe('list-1');
    });

    it('404s when the parent list is outside the company', async () => {
      mockPrisma.materialList.findFirst.mockReset().mockResolvedValueOnce(null);
      await expect(service.removeItem('list-x', 'item-1', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.materialListItem.deleteMany).not.toHaveBeenCalled();
    });
  });
});
