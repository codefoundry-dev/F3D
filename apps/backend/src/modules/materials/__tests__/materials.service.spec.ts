import { ConflictException, NotFoundException } from '@nestjs/common';
import { MaterialStatus, UserRole } from '@prisma/client';

import { MaterialsService } from '../materials.service';

const mockPrisma = {
  material: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  materialCategory: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

const superAdmin = {
  id: 'sa-1',
  email: 'sa@test.com',
  role: UserRole.SUPER_ADMIN,
  companyId: null,
};

const companyAdmin = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};

describe('MaterialsService', () => {
  let service: MaterialsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MaterialsService(mockPrisma as never);
  });

  // ── listMaterials ──────────────────────────────────────────────────────

  describe('listMaterials', () => {
    beforeEach(() => {
      mockPrisma.material.findMany.mockResolvedValue([]);
      mockPrisma.material.count.mockResolvedValue(0);
    });

    it('returns paginated list with mapped items', async () => {
      const now = new Date('2026-03-01T10:00:00Z');
      mockPrisma.material.findMany.mockResolvedValue([
        {
          id: 'm-1',
          name: 'Steel Rebar',
          category: { id: 'cat-1', name: 'Steel' },
          uom: 'kg',
          upc: '1234567890',
          manufacturer: 'SteelCo',
          description: 'A steel rebar',
          status: MaterialStatus.PUBLIC,
          createdAt: now,
        },
      ]);
      mockPrisma.material.count.mockResolvedValue(1);

      const result = await service.listMaterials(
        { page: 1, take: 25, skip: 0 } as never,
        superAdmin,
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 'm-1',
        name: 'Steel Rebar',
        categoryId: 'cat-1',
        categoryName: 'Steel',
        uom: 'kg',
        upc: '1234567890',
        manufacturer: 'SteelCo',
        description: 'A steel rebar',
        status: MaterialStatus.PUBLIC,
        createdAt: now.toISOString(),
      });
      expect(result.meta).toBeDefined();
    });

    it('filters by status when provided', async () => {
      await service.listMaterials(
        { page: 1, take: 25, skip: 0, status: 'PENDING_APPROVAL' } as never,
        superAdmin,
      );

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('PENDING_APPROVAL');
    });

    it('defaults to PUBLIC status for non-SuperAdmin', async () => {
      await service.listMaterials({ page: 1, take: 25, skip: 0 } as never, companyAdmin);

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(MaterialStatus.PUBLIC);
    });

    it('does not default status filter for SuperAdmin', async () => {
      await service.listMaterials({ page: 1, take: 25, skip: 0 } as never, superAdmin);

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      expect(where.status).toBeUndefined();
    });

    it('applies categoryId filter', async () => {
      await service.listMaterials(
        { page: 1, take: 25, skip: 0, categoryId: 'cat-1' } as never,
        superAdmin,
      );

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      expect(where.categoryId).toBe('cat-1');
    });

    it('applies search filter', async () => {
      await service.listMaterials(
        { page: 1, take: 25, skip: 0, search: 'steel' } as never,
        superAdmin,
      );

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      expect(where.name).toEqual({ contains: 'steel', mode: 'insensitive' });
    });

    it('sorts by createdAt when specified', async () => {
      await service.listMaterials(
        { page: 1, take: 25, skip: 0, sortBy: 'createdAt', sortDir: 'desc' } as never,
        superAdmin,
      );

      const orderBy = mockPrisma.material.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ createdAt: 'desc' });
    });

    it('defaults sort to name asc', async () => {
      await service.listMaterials({ page: 1, take: 25, skip: 0 } as never, superAdmin);

      const orderBy = mockPrisma.material.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ name: 'asc' });
    });

    it('falls back to name sort for unknown sortBy', async () => {
      await service.listMaterials(
        { page: 1, take: 25, skip: 0, sortBy: 'unknown', sortDir: 'desc' } as never,
        superAdmin,
      );

      const orderBy = mockPrisma.material.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ name: 'desc' });
    });
  });

  // ── listCategories ────────────────────────────────────────────────────

  describe('listCategories', () => {
    it('returns categories with id and name', async () => {
      mockPrisma.materialCategory.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Steel' },
        { id: 'cat-2', name: 'Timber' },
      ]);

      const result = await service.listCategories();
      expect(result).toEqual([
        { id: 'cat-1', name: 'Steel' },
        { id: 'cat-2', name: 'Timber' },
      ]);
    });
  });

  // ── suggestions ───────────────────────────────────────────────────────

  describe('suggestions', () => {
    it('returns mapped suggestions', async () => {
      mockPrisma.material.findMany.mockResolvedValue([
        { id: 'm-1', name: 'Bolt', category: { name: 'Fasteners' }, uom: 'pcs' },
      ]);

      const result = await service.suggestions('bolt');
      expect(result).toEqual([{ id: 'm-1', name: 'Bolt', categoryName: 'Fasteners', uom: 'pcs' }]);
    });

    it('applies search filter for non-empty string', async () => {
      mockPrisma.material.findMany.mockResolvedValue([]);
      await service.suggestions('test');

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      expect(where.name).toEqual({ contains: 'test', mode: 'insensitive' });
    });

    it('does not apply name filter for empty search', async () => {
      mockPrisma.material.findMany.mockResolvedValue([]);
      await service.suggestions('');

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      expect(where.name).toBeUndefined();
    });
  });

  // ── createMaterial ────────────────────────────────────────────────────

  describe('createMaterial', () => {
    const dto = {
      name: 'New Material',
      categoryId: 'cat-1',
      uom: 'kg',
      upc: 'UPC-123',
      manufacturer: 'MfgCo',
      description: 'A material',
    };

    it('creates material with PUBLIC status for SuperAdmin', async () => {
      mockPrisma.material.findFirst.mockResolvedValue(null);
      mockPrisma.materialCategory.findUnique.mockResolvedValue({ id: 'cat-1' });
      const now = new Date('2026-03-01T10:00:00Z');
      mockPrisma.material.create.mockResolvedValue({
        id: 'm-new',
        name: 'New Material',
        category: { id: 'cat-1', name: 'Steel' },
        uom: 'kg',
        upc: 'UPC-123',
        manufacturer: 'MfgCo',
        description: 'A material',
        status: MaterialStatus.PUBLIC,
        createdAt: now,
      });

      const result = await service.createMaterial(dto as never, superAdmin);
      expect(result.status).toBe(MaterialStatus.PUBLIC);
      expect(result.id).toBe('m-new');

      const createData = mockPrisma.material.create.mock.calls[0][0].data;
      expect(createData.status).toBe(MaterialStatus.PUBLIC);
    });

    it('creates material with PENDING_APPROVAL status for non-SuperAdmin', async () => {
      mockPrisma.material.findFirst.mockResolvedValue(null);
      mockPrisma.materialCategory.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.material.create.mockResolvedValue({
        id: 'm-new',
        name: 'New Material',
        category: { id: 'cat-1', name: 'Steel' },
        uom: 'kg',
        upc: null,
        manufacturer: null,
        description: null,
        status: MaterialStatus.PENDING_APPROVAL,
        createdAt: new Date(),
      });

      await service.createMaterial(dto as never, companyAdmin);

      const createData = mockPrisma.material.create.mock.calls[0][0].data;
      expect(createData.status).toBe(MaterialStatus.PENDING_APPROVAL);
    });

    it('throws ConflictException for duplicate name', async () => {
      mockPrisma.material.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.createMaterial(dto as never, superAdmin)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException when category does not exist', async () => {
      mockPrisma.material.findFirst.mockResolvedValue(null);
      mockPrisma.materialCategory.findUnique.mockResolvedValue(null);

      await expect(service.createMaterial(dto as never, superAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('sets optional fields to null when not provided', async () => {
      const minDto = { name: 'Minimal', categoryId: 'cat-1', uom: 'kg' };
      mockPrisma.material.findFirst.mockResolvedValue(null);
      mockPrisma.materialCategory.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.material.create.mockResolvedValue({
        id: 'm-min',
        name: 'Minimal',
        category: { id: 'cat-1', name: 'General' },
        uom: 'kg',
        upc: null,
        manufacturer: null,
        description: null,
        status: MaterialStatus.PUBLIC,
        createdAt: new Date(),
      });

      await service.createMaterial(minDto as never, superAdmin);

      const createData = mockPrisma.material.create.mock.calls[0][0].data;
      expect(createData.upc).toBeNull();
      expect(createData.manufacturer).toBeNull();
      expect(createData.description).toBeNull();
    });
  });
});
