import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocExtractionStatus, DocExtractionType, MaterialStatus, UserRole } from '@prisma/client';

import { MaterialsService } from '../materials.service';

const mockPrisma = {
  material: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  materialCategory: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  docExtraction: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
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

  // ── importCatalogueFromExtraction ─────────────────────────────────────────

  describe('importCatalogueFromExtraction', () => {
    const confirmedExtraction = (items: unknown[]) => ({
      id: 'ext-1',
      type: DocExtractionType.CATALOGUE,
      status: DocExtractionStatus.CONFIRMED,
      createdByUserId: superAdmin.id,
      companyId: null,
      editedResult: { sourceName: 'Sheet1', items, notes: null },
    });

    const line = (over: Record<string, unknown>) => ({
      name: 'Cable',
      sku: 'SK-1',
      brand: 'Acme',
      manufacturerPartNumber: 'MPN-1',
      upc: '111',
      uom: 'ea',
      description: 'desc',
      mainCategory: 'Electrical',
      subCategory: 'Wiring',
      imageUrl: null,
      confidence: 1,
      ...over,
    });

    beforeEach(() => {
      // Category upsert defaults: nothing exists, so create() is hit per category.
      mockPrisma.materialCategory.findUnique.mockResolvedValue(null);
      let catSeq = 0;
      mockPrisma.materialCategory.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: `cat-${(catSeq += 1)}`, name: data.name }),
      );
      // $transaction(callback) → run the callback with a tx proxy that owns $queryRaw.
      mockPrisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
        cb({ $queryRaw: mockPrisma.$queryRaw }),
      );
    });

    it('throws NotFound when extraction is missing', async () => {
      mockPrisma.docExtraction.findUnique.mockResolvedValue(null);
      await expect(service.importCatalogueFromExtraction('missing', superAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFound when extraction is not a CATALOGUE type', async () => {
      mockPrisma.docExtraction.findUnique.mockResolvedValue({
        ...confirmedExtraction([]),
        type: DocExtractionType.BOM,
      });
      await expect(service.importCatalogueFromExtraction('ext-1', superAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws Forbidden when the user cannot access the extraction', async () => {
      mockPrisma.docExtraction.findUnique.mockResolvedValue({
        ...confirmedExtraction([line({})]),
        createdByUserId: 'someone-else',
        companyId: 'other-co',
      });
      await expect(service.importCatalogueFromExtraction('ext-1', companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws Forbidden when the extraction has not produced a result yet', async () => {
      mockPrisma.docExtraction.findUnique.mockResolvedValue({
        ...confirmedExtraction([line({})]),
        status: DocExtractionStatus.PENDING,
      });
      await expect(service.importCatalogueFromExtraction('ext-1', superAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns zeros when there are no items', async () => {
      mockPrisma.docExtraction.findUnique.mockResolvedValue(confirmedExtraction([]));
      const summary = await service.importCatalogueFromExtraction('ext-1', superAdmin);
      expect(summary).toEqual({
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        categoriesCreated: 0,
      });
    });

    it('imports a COMPLETED (not yet CONFIRMED) extraction and marks it CONFIRMED', async () => {
      mockPrisma.docExtraction.findUnique.mockResolvedValue({
        ...confirmedExtraction([line({ sku: 'SK-1' })]),
        status: DocExtractionStatus.COMPLETED,
      });
      mockPrisma.$queryRaw.mockResolvedValue([{ inserted: true }]);

      const summary = await service.importCatalogueFromExtraction('ext-1', superAdmin);

      expect(summary.total).toBe(1);
      expect(summary.created).toBe(1);
      // The extraction is locked once its rows land in the catalogue.
      expect(mockPrisma.docExtraction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ext-1' },
          data: expect.objectContaining({ status: DocExtractionStatus.CONFIRMED }),
        }),
      );
    });

    it('upserts SKU rows via raw ON CONFLICT and counts created vs updated', async () => {
      mockPrisma.docExtraction.findUnique.mockResolvedValue(
        confirmedExtraction([line({ sku: 'SK-1' }), line({ name: 'Switch', sku: 'SK-2' })]),
      );
      // First row inserted, second updated.
      mockPrisma.$queryRaw.mockResolvedValue([{ inserted: true }, { inserted: false }]);

      const summary = await service.importCatalogueFromExtraction('ext-1', superAdmin);

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(summary.total).toBe(2);
      expect(summary.created).toBe(1);
      expect(summary.updated).toBe(1);
      expect(summary.skipped).toBe(0);
      // Electrical (×2 distinct names collapse to one) + Uncategorised fallback.
      expect(summary.categoriesCreated).toBe(2);
    });

    it('dedupes sku-less rows by name: updates when found, inserts otherwise', async () => {
      mockPrisma.docExtraction.findUnique.mockResolvedValue(
        confirmedExtraction([
          line({ name: 'Existing', sku: null }),
          line({ name: 'Brand New', sku: null }),
        ]),
      );
      mockPrisma.material.findFirst
        .mockResolvedValueOnce({ id: 'mat-existing' })
        .mockResolvedValueOnce(null);
      mockPrisma.material.update.mockResolvedValue({});
      mockPrisma.material.create.mockResolvedValue({});

      const summary = await service.importCatalogueFromExtraction('ext-1', superAdmin);

      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      expect(mockPrisma.material.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.material.create).toHaveBeenCalledTimes(1);
      expect(summary.updated).toBe(1);
      expect(summary.created).toBe(1);
    });

    it('routes rows with no main category to the Uncategorised fallback', async () => {
      mockPrisma.docExtraction.findUnique.mockResolvedValue(
        confirmedExtraction([line({ sku: null, mainCategory: null })]),
      );
      mockPrisma.material.findFirst.mockResolvedValue(null);
      mockPrisma.material.create.mockResolvedValue({});

      await service.importCatalogueFromExtraction('ext-1', superAdmin);

      // Only the Uncategorised category is created (no main category supplied).
      const createdNames = mockPrisma.materialCategory.create.mock.calls.map((c) => c[0].data.name);
      expect(createdNames).toEqual(['Uncategorised']);
      const createArg = mockPrisma.material.create.mock.calls[0][0].data;
      expect(createArg.categoryId).toBe('cat-1');
    });

    it('counts name-less rows as skipped', async () => {
      mockPrisma.docExtraction.findUnique.mockResolvedValue(
        confirmedExtraction([line({ sku: 'SK-1' }), line({ name: '   ', sku: 'SK-2' })]),
      );
      mockPrisma.$queryRaw.mockResolvedValue([{ inserted: true }]);

      const summary = await service.importCatalogueFromExtraction('ext-1', superAdmin);

      expect(summary.total).toBe(1);
      expect(summary.skipped).toBe(1);
      expect(summary.created).toBe(1);
    });

    it('reuses an existing category instead of creating a duplicate', async () => {
      mockPrisma.docExtraction.findUnique.mockResolvedValue(
        confirmedExtraction([line({ sku: 'SK-1', mainCategory: 'Electrical' })]),
      );
      // 'Electrical' already exists; 'Uncategorised' fallback does not.
      mockPrisma.materialCategory.findUnique.mockImplementation(({ where }) =>
        Promise.resolve(
          where.name === 'Electrical' ? { id: 'cat-existing', name: 'Electrical' } : null,
        ),
      );
      mockPrisma.$queryRaw.mockResolvedValue([{ inserted: true }]);

      const summary = await service.importCatalogueFromExtraction('ext-1', superAdmin);

      // Only the Uncategorised fallback is newly created — Electrical is reused.
      expect(summary.categoriesCreated).toBe(1);
      expect(mockPrisma.materialCategory.create).toHaveBeenCalledTimes(1);
    });

    it('allows the extraction owner (non-superadmin) to import', async () => {
      mockPrisma.docExtraction.findUnique.mockResolvedValue({
        ...confirmedExtraction([line({ sku: 'SK-1' })]),
        status: DocExtractionStatus.COMPLETED,
        createdByUserId: companyAdmin.id,
        companyId: null,
      });
      mockPrisma.$queryRaw.mockResolvedValue([{ inserted: true }]);

      const summary = await service.importCatalogueFromExtraction('ext-1', companyAdmin);

      expect(summary.total).toBe(1);
    });

    it('allows a same-company user (non-owner) to import', async () => {
      mockPrisma.docExtraction.findUnique.mockResolvedValue({
        ...confirmedExtraction([line({ sku: 'SK-1' })]),
        status: DocExtractionStatus.COMPLETED,
        createdByUserId: 'someone-else',
        companyId: companyAdmin.companyId,
      });
      mockPrisma.$queryRaw.mockResolvedValue([{ inserted: true }]);

      const summary = await service.importCatalogueFromExtraction('ext-1', companyAdmin);

      expect(summary.total).toBe(1);
    });

    it('returns zeros when the edited result is null', async () => {
      mockPrisma.docExtraction.findUnique.mockResolvedValue({
        ...confirmedExtraction([]),
        editedResult: null,
      });

      const summary = await service.importCatalogueFromExtraction('ext-1', superAdmin);

      expect(summary).toEqual({
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        categoriesCreated: 0,
      });
    });

    it('handles sku-less rows whose optional fields are all null/blank', async () => {
      mockPrisma.docExtraction.findUnique.mockResolvedValue(
        confirmedExtraction([
          line({
            name: 'Bare',
            sku: null,
            brand: null,
            upc: null,
            description: null,
            manufacturerPartNumber: null,
            subCategory: null,
            imageUrl: null,
            uom: '',
          }),
        ]),
      );
      mockPrisma.material.findFirst.mockResolvedValue(null);
      mockPrisma.material.create.mockResolvedValue({});

      const summary = await service.importCatalogueFromExtraction('ext-1', superAdmin);

      expect(summary.created).toBe(1);
      const createArg = mockPrisma.material.create.mock.calls[0][0].data;
      expect(createArg.brand).toBeNull();
      expect(createArg.upc).toBeNull();
    });

    it('handles SKU rows whose optional fields are all null/blank', async () => {
      mockPrisma.docExtraction.findUnique.mockResolvedValue(
        confirmedExtraction([
          line({
            sku: 'SK-1',
            brand: null,
            upc: null,
            description: null,
            manufacturerPartNumber: null,
            subCategory: null,
            imageUrl: null,
            uom: '',
          }),
        ]),
      );
      mockPrisma.$queryRaw.mockResolvedValue([{ inserted: true }]);

      const summary = await service.importCatalogueFromExtraction('ext-1', superAdmin);

      expect(summary.total).toBe(1);
      expect(summary.created).toBe(1);
    });
  });
});
