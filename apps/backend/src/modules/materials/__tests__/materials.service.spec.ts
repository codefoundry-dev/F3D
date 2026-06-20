import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DocExtractionStatus, DocExtractionType, MaterialStatus, UserRole } from '@prisma/client';

import { MaterialsService } from '../materials.service';

const mockPrisma = {
  material: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  materialCategory: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  poLineItem: { count: jest.fn() },
  rfqLineItem: { count: jest.fn() },
  quoteResponseLineItem: { count: jest.fn() },
  bomItem: { count: jest.fn() },
  materialListItem: { count: jest.fn() },
  docExtraction: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  materialChangeRequest: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  materialFavourite: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  materialUsage: {
    findMany: jest.fn(),
    upsert: jest.fn(),
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
    // Default: no favourites — list/detail mappers resolve isFavourite = false
    // unless a test overrides these.
    mockPrisma.materialFavourite.findMany.mockResolvedValue([]);
    mockPrisma.materialFavourite.findUnique.mockResolvedValue(null);
    // Default: no usage history — recently/frequently used resolve to [].
    mockPrisma.materialUsage.findMany.mockResolvedValue([]);
  });

  // ── listMaterials ──────────────────────────────────────────────────────

  describe('listMaterials', () => {
    beforeEach(() => {
      mockPrisma.material.findMany.mockResolvedValue([]);
      mockPrisma.material.count.mockResolvedValue(0);
    });

    it('returns paginated list with mapped items', async () => {
      const now = new Date('2026-03-01T10:00:00Z');
      const updated = new Date('2026-03-02T10:00:00Z');
      mockPrisma.material.findMany.mockResolvedValue([
        {
          id: 'm-1',
          name: 'Steel Rebar',
          category: { id: 'cat-1', name: 'Steel' },
          uom: 'kg',
          upc: '1234567890',
          manufacturer: 'SteelCo',
          description: 'A steel rebar',
          sku: 'SKU-1',
          brand: 'SteelCo',
          manufacturerPartNumber: 'MPN-1',
          subCategory: 'Bars',
          imageUrl: null,
          materialType: 'Bar',
          countryOfOrigin: 'AU',
          pricePerUnit: { toString: () => '12.5000' },
          currency: 'AUD',
          status: MaterialStatus.PUBLIC,
          companyId: null,
          createdAt: now,
          updatedAt: updated,
        },
      ]);
      mockPrisma.material.count.mockResolvedValue(1);
      // m-1 is favourited by the caller.
      mockPrisma.materialFavourite.findMany.mockResolvedValue([{ materialId: 'm-1' }]);

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
        sku: 'SKU-1',
        brand: 'SteelCo',
        manufacturerPartNumber: 'MPN-1',
        subCategory: 'Bars',
        imageUrl: null,
        materialType: 'Bar',
        countryOfOrigin: 'AU',
        pricePerUnit: '12.5000',
        currency: 'AUD',
        status: MaterialStatus.PUBLIC,
        companyId: null,
        isFavourite: true,
        createdAt: now.toISOString(),
        updatedAt: updated.toISOString(),
      });
      expect(result.meta).toBeDefined();
    });

    it('maps companyId and a false isFavourite when the material is not favourited', async () => {
      const now = new Date('2026-03-01T10:00:00Z');
      mockPrisma.material.findMany.mockResolvedValue([
        {
          id: 'm-2',
          name: 'Private Cable',
          category: { id: 'cat-1', name: 'Electrical' },
          uom: 'm',
          upc: null,
          manufacturer: null,
          description: null,
          sku: null,
          brand: null,
          manufacturerPartNumber: null,
          subCategory: null,
          imageUrl: null,
          materialType: null,
          countryOfOrigin: null,
          pricePerUnit: null,
          currency: 'AUD',
          status: MaterialStatus.PENDING_APPROVAL,
          companyId: 'comp-1',
          createdAt: now,
          updatedAt: now,
        },
      ]);
      mockPrisma.material.count.mockResolvedValue(1);

      const result = await service.listMaterials(
        { page: 1, take: 25, skip: 0 } as never,
        companyAdmin,
      );

      expect(result.items[0].companyId).toBe('comp-1');
      expect(result.items[0].isFavourite).toBe(false);
    });

    it('filters by status when provided', async () => {
      await service.listMaterials(
        { page: 1, take: 25, skip: 0, status: 'PENDING_APPROVAL' } as never,
        superAdmin,
      );

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('PENDING_APPROVAL');
    });

    it('builds the visibility envelope (public OR own company) for a non-SuperAdmin', async () => {
      await service.listMaterials({ page: 1, take: 25, skip: 0 } as never, companyAdmin);

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      // Non-SA sees PUBLIC rows plus their own company's rows; no top-level status.
      expect(where.status).toBeUndefined();
      expect(where.AND).toEqual([
        {
          OR: [{ status: MaterialStatus.PUBLIC }, { companyId: companyAdmin.companyId }],
        },
      ]);
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

    it('defaults sort to case-insensitive name asc (alphabetical)', async () => {
      await service.listMaterials({ page: 1, take: 25, skip: 0 } as never, superAdmin);

      // nameCi = lower(name): true A->Z regardless of the column's collation.
      const orderBy = mockPrisma.material.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ nameCi: 'asc' });
    });

    it('falls back to case-insensitive name sort for unknown sortBy', async () => {
      await service.listMaterials(
        { page: 1, take: 25, skip: 0, sortBy: 'unknown', sortDir: 'desc' } as never,
        superAdmin,
      );

      const orderBy = mockPrisma.material.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ nameCi: 'desc' });
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
    const row = {
      id: 'm-1',
      name: 'Bolt',
      category: { name: 'Fasteners' },
      uom: 'pcs',
      description: 'M8 bolt',
      imageUrl: 'http://img/bolt.png',
    };

    it('returns the grouped shape with mapped result rows', async () => {
      mockPrisma.material.findMany.mockResolvedValue([row]);

      const result = await service.suggestions('bolt', companyAdmin);

      expect(result).toEqual({
        results: [
          {
            id: 'm-1',
            name: 'Bolt',
            categoryName: 'Fasteners',
            uom: 'pcs',
            description: 'M8 bolt',
            imageUrl: 'http://img/bolt.png',
          },
        ],
        recentlyUsed: [],
        frequentlyUsed: [],
      });
    });

    it('matches the term against name / UPC / manufacturer (case-insensitive)', async () => {
      mockPrisma.material.findMany.mockResolvedValue([]);
      await service.suggestions('test', companyAdmin);

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      // where = { AND: [ visibility, { OR: [name, upc, manufacturer] } ] }
      const orClause = where.AND[1].OR;
      expect(orClause).toEqual([
        { name: { contains: 'test', mode: 'insensitive' } },
        { upc: { contains: 'test', mode: 'insensitive' } },
        { manufacturer: { contains: 'test', mode: 'insensitive' } },
      ]);
    });

    it('does not apply the term filter for empty/whitespace search', async () => {
      mockPrisma.material.findMany.mockResolvedValue([]);
      await service.suggestions('   ', companyAdmin);

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      expect(where.AND).toHaveLength(1); // visibility only, no term clause
    });

    it('scopes results to public OR the user company-private rows (US 4.02)', async () => {
      mockPrisma.material.findMany.mockResolvedValue([]);
      await service.suggestions('cable', companyAdmin);

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      expect(where.AND[0].OR).toEqual([
        { status: MaterialStatus.PUBLIC },
        { companyId: companyAdmin.companyId },
      ]);
    });

    it('falls back to a sentinel companyId for a user with no company (sees only PUBLIC)', async () => {
      mockPrisma.material.findMany.mockResolvedValue([]);
      await service.suggestions('cable', superAdmin); // companyId: null

      // results visibility AND both usage-group visibility filters use the sentinel.
      const resultsWhere = mockPrisma.material.findMany.mock.calls[0][0].where;
      expect(resultsWhere.AND[0].OR).toEqual([
        { status: MaterialStatus.PUBLIC },
        { companyId: '__none__' },
      ]);
      const usageWhere = mockPrisma.materialUsage.findMany.mock.calls[0][0].where;
      expect(usageWhere.material.OR).toEqual([
        { status: MaterialStatus.PUBLIC },
        { companyId: '__none__' },
      ]);
    });

    it('maps a null category to categoryName: null', async () => {
      mockPrisma.material.findMany.mockResolvedValue([
        { id: 'm-9', name: 'Loose', category: null, uom: null, description: null, imageUrl: null },
      ]);

      const result = await service.suggestions('loose', companyAdmin);
      expect(result.results[0]).toEqual({
        id: 'm-9',
        name: 'Loose',
        categoryName: null,
        uom: null,
        description: null,
        imageUrl: null,
      });
    });

    it('defaults the per-group limit to 8 and clamps it to a max of 25', async () => {
      mockPrisma.material.findMany.mockResolvedValue([]);

      await service.suggestions('x', companyAdmin); // no limit → default 8
      expect(mockPrisma.material.findMany.mock.calls[0][0].take).toBe(8);

      await service.suggestions('x', companyAdmin, 100); // over cap → 25
      expect(mockPrisma.material.findMany.mock.calls[1][0].take).toBe(25);

      await service.suggestions('x', companyAdmin, 3); // honoured
      expect(mockPrisma.material.findMany.mock.calls[2][0].take).toBe(3);

      await service.suggestions('x', companyAdmin, 0); // < 1 → default 8
      expect(mockPrisma.material.findMany.mock.calls[3][0].take).toBe(8);
    });

    it('fills recentlyUsed (lastUsedAt desc) and frequentlyUsed (useCount desc) from usage rows', async () => {
      mockPrisma.material.findMany.mockResolvedValue([]);
      mockPrisma.materialUsage.findMany
        .mockResolvedValueOnce([{ material: row }]) // recentlyUsed call
        .mockResolvedValueOnce([{ material: row }]); // frequentlyUsed call

      const result = await service.suggestions('', companyAdmin);

      expect(result.recentlyUsed).toEqual([
        {
          id: 'm-1',
          name: 'Bolt',
          categoryName: 'Fasteners',
          uom: 'pcs',
          description: 'M8 bolt',
          imageUrl: 'http://img/bolt.png',
        },
      ]);
      expect(result.frequentlyUsed).toHaveLength(1);
      // The two usage queries use the two different orderings, scoped to the user.
      const orderings = mockPrisma.materialUsage.findMany.mock.calls.map((c) => c[0].orderBy);
      expect(orderings).toContainEqual({ lastUsedAt: 'desc' });
      expect(orderings).toContainEqual({ useCount: 'desc' });
      mockPrisma.materialUsage.findMany.mock.calls.forEach((c) => {
        expect(c[0].where.userId).toBe(companyAdmin.id);
      });
    });
  });

  describe('recordMaterialUsage', () => {
    it('upserts one row per distinct material (insert + increment semantics)', async () => {
      mockPrisma.materialUsage.upsert.mockResolvedValue({});

      await service.recordMaterialUsage('u-1', ['m-1', 'm-2', 'm-1']);

      // De-duplicated to 2 distinct materials.
      expect(mockPrisma.materialUsage.upsert).toHaveBeenCalledTimes(2);
      const first = mockPrisma.materialUsage.upsert.mock.calls[0][0];
      expect(first.where).toEqual({ userId_materialId: { userId: 'u-1', materialId: 'm-1' } });
      expect(first.create).toMatchObject({ userId: 'u-1', materialId: 'm-1', useCount: 1 });
      expect(first.update.useCount).toEqual({ increment: 1 });
    });

    it('no-ops on an empty / falsy id list', async () => {
      await service.recordMaterialUsage('u-1', []);
      expect(mockPrisma.materialUsage.upsert).not.toHaveBeenCalled();
    });

    it('swallows a failed upsert so it never breaks the originating action', async () => {
      mockPrisma.materialUsage.upsert.mockRejectedValue(new Error('db down'));
      await expect(service.recordMaterialUsage('u-1', ['m-1'])).resolves.toBeUndefined();
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
        updatedAt: now,
      });

      const result = await service.createMaterial(dto as never, superAdmin);
      expect(result.status).toBe(MaterialStatus.PUBLIC);
      expect(result.id).toBe('m-new');

      const createData = mockPrisma.material.create.mock.calls[0][0].data;
      expect(createData.status).toBe(MaterialStatus.PUBLIC);
      // A SuperAdmin create is a PUBLIC, shared catalogue row (no owning company).
      expect(createData.companyId).toBeNull();
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
        updatedAt: new Date(),
      });

      await service.createMaterial(dto as never, companyAdmin);

      const createData = mockPrisma.material.create.mock.calls[0][0].data;
      expect(createData.status).toBe(MaterialStatus.PENDING_APPROVAL);
      // A non-SuperAdmin create is a company-private row scoped to their company.
      expect(createData.companyId).toBe(companyAdmin.companyId);
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
        updatedAt: new Date(),
      });

      await service.createMaterial(minDto as never, superAdmin);

      const createData = mockPrisma.material.create.mock.calls[0][0].data;
      expect(createData.upc).toBeNull();
      expect(createData.manufacturer).toBeNull();
      expect(createData.description).toBeNull();
    });

    it('persists the full rich Core + Additional payload and returns the detail shape', async () => {
      const richDto = {
        name: 'Colorbond Roofing Sheet 0.42mm',
        categoryId: 'cat-1',
        uom: 'sheet',
        materialType: 'Roofing',
        itemType: 'Sheet',
        countryOfOrigin: 'Australia',
        manufacturerSeriesModel: 'CEM-001',
        gradeClass: 'C24',
        standardNorm: 'EN',
        colourFinish: 'Surfmist',
        size: '123x456x123',
        pricePerUnit: 42.5,
        currency: 'AUD',
        sku: 'ROOF-007',
        dimensions: { length: { value: 100, uom: 'mm' }, packaging: { unitsPerPackage: 10 } },
        properties: { compressiveStrength: '12345678', density: '1234' },
      };
      const now = new Date('2026-03-02T10:00:00Z');
      mockPrisma.material.findFirst.mockResolvedValue(null);
      mockPrisma.materialCategory.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.material.create.mockResolvedValue({
        id: 'm-rich',
        name: richDto.name,
        category: { id: 'cat-1', name: 'Roofing' },
        createdBy: { id: 'sa-1', name: 'Super Admin' },
        uom: 'sheet',
        upc: null,
        manufacturer: null,
        description: null,
        sku: 'ROOF-007',
        brand: null,
        manufacturerPartNumber: null,
        subCategory: null,
        imageUrl: null,
        materialType: 'Roofing',
        itemType: 'Sheet',
        countryOfOrigin: 'Australia',
        manufacturerSeriesModel: 'CEM-001',
        gradeClass: 'C24',
        standardNorm: 'EN',
        colourFinish: 'Surfmist',
        size: '123x456x123',
        pricePerUnit: { toString: () => '42.5' },
        currency: 'AUD',
        dimensions: richDto.dimensions,
        properties: richDto.properties,
        status: MaterialStatus.PUBLIC,
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.createMaterial(richDto as never, superAdmin);

      const createData = mockPrisma.material.create.mock.calls[0][0].data;
      expect(createData.materialType).toBe('Roofing');
      expect(createData.itemType).toBe('Sheet');
      expect(createData.countryOfOrigin).toBe('Australia');
      expect(createData.gradeClass).toBe('C24');
      expect(createData.pricePerUnit).toBe(42.5);
      expect(createData.currency).toBe('AUD');
      expect(createData.dimensions).toEqual(richDto.dimensions);
      expect(createData.properties).toEqual(richDto.properties);

      // Returned in the full detail shape (createdBy, dimensions, properties).
      expect(result.materialType).toBe('Roofing');
      expect(result.pricePerUnit).toBe('42.5');
      expect(result.dimensions).toEqual(richDto.dimensions);
      expect(result.properties).toEqual(richDto.properties);
      expect(result.createdBy).toEqual({ id: 'sa-1', name: 'Super Admin' });
    });

    it('falls back to a find-or-created "Uncategorised" category when categoryId is omitted', async () => {
      // The BOM "create private material" quick-add submits no categoryId.
      const noCatDto = { name: 'Private Mat', uom: 'kg' };
      mockPrisma.material.findFirst.mockResolvedValue(null);
      // "Uncategorised" does not exist yet → it is created.
      mockPrisma.materialCategory.findUnique.mockResolvedValue(null);
      mockPrisma.materialCategory.create.mockResolvedValue({
        id: 'uncat-1',
        name: 'Uncategorised',
      });
      const now = new Date('2026-03-03T10:00:00Z');
      mockPrisma.material.create.mockResolvedValue({
        id: 'm-priv',
        name: 'Private Mat',
        category: { id: 'uncat-1', name: 'Uncategorised' },
        createdBy: null,
        uom: 'kg',
        currency: 'AUD',
        status: MaterialStatus.PENDING_APPROVAL,
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.createMaterial(noCatDto as never, companyAdmin);

      expect(mockPrisma.materialCategory.findUnique).toHaveBeenCalledWith({
        where: { name: 'Uncategorised' },
      });
      expect(mockPrisma.materialCategory.create).toHaveBeenCalledWith({
        data: { name: 'Uncategorised' },
      });
      const createData = mockPrisma.material.create.mock.calls[0][0].data;
      expect(createData.categoryId).toBe('uncat-1');
      expect(result.categoryId).toBe('uncat-1');
      expect(result.status).toBe(MaterialStatus.PENDING_APPROVAL);
    });

    it('reuses an existing "Uncategorised" category without creating a duplicate', async () => {
      const noCatDto = { name: 'Another Private Mat', uom: 'ea' };
      mockPrisma.material.findFirst.mockResolvedValue(null);
      mockPrisma.materialCategory.findUnique.mockResolvedValue({
        id: 'uncat-existing',
        name: 'Uncategorised',
      });
      const now = new Date('2026-03-03T11:00:00Z');
      mockPrisma.material.create.mockResolvedValue({
        id: 'm-priv-2',
        name: 'Another Private Mat',
        category: { id: 'uncat-existing', name: 'Uncategorised' },
        createdBy: null,
        uom: 'ea',
        currency: 'AUD',
        status: MaterialStatus.PENDING_APPROVAL,
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.createMaterial(noCatDto as never, companyAdmin);

      expect(mockPrisma.materialCategory.create).not.toHaveBeenCalled();
      expect(result.categoryId).toBe('uncat-existing');
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

  // ── buildListWhere security clamp ──────────────────────────────────────────

  describe('list status visibility (US 4.01 security)', () => {
    beforeEach(() => {
      mockPrisma.material.findMany.mockResolvedValue([]);
      mockPrisma.material.count.mockResolvedValue(0);
    });

    it('AND-s an explicit status inside the visibility envelope for a non-SuperAdmin', async () => {
      await service.listMaterials(
        { page: 1, take: 25, skip: 0, status: 'ARCHIVED' } as never,
        companyAdmin,
      );

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      // The explicit status is AND-ed inside the envelope: an ARCHIVED tab shows
      // only the company's own archived rows (public rows are always PUBLIC), so
      // it never leaks another company's or an unpublished public row.
      expect(where.status).toBeUndefined();
      expect(where.AND).toEqual([
        { OR: [{ status: MaterialStatus.PUBLIC }, { companyId: companyAdmin.companyId }] },
        { status: 'ARCHIVED' },
      ]);
    });

    it('filters to the user favourites when favourite=true', async () => {
      await service.listMaterials(
        { page: 1, take: 25, skip: 0, favourite: true } as never,
        companyAdmin,
      );

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      expect(where.favourites).toEqual({ some: { userId: companyAdmin.id } });
    });

    it('does not add a favourites filter when favourite is absent/false', async () => {
      await service.listMaterials(
        { page: 1, take: 25, skip: 0, favourite: false } as never,
        companyAdmin,
      );

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      expect(where.favourites).toBeUndefined();
    });

    it('honours an explicit status for SuperAdmin', async () => {
      await service.listMaterials(
        { page: 1, take: 25, skip: 0, status: 'ARCHIVED' } as never,
        superAdmin,
      );

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('ARCHIVED');
    });

    it('applies facet filters (manufacturer/uom/materialType/countryOfOrigin)', async () => {
      await service.listMaterials(
        {
          page: 1,
          take: 25,
          skip: 0,
          manufacturer: 'Acme',
          uom: 'kg',
          materialType: 'Steel',
          countryOfOrigin: 'AU',
        } as never,
        superAdmin,
      );

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      expect(where.manufacturer).toEqual({ contains: 'Acme', mode: 'insensitive' });
      expect(where.uom).toBe('kg');
      expect(where.materialType).toBe('Steel');
      expect(where.countryOfOrigin).toBe('AU');
    });
  });

  // ── getMaterialById ────────────────────────────────────────────────────────

  describe('getMaterialById', () => {
    const publicMaterial = {
      id: 'm-1',
      name: 'Steel Rebar',
      category: { id: 'cat-1', name: 'Steel' },
      createdBy: { id: 'u-1', name: 'Jane Admin' },
      uom: 'kg',
      upc: null,
      manufacturer: null,
      description: null,
      sku: null,
      brand: null,
      manufacturerPartNumber: null,
      subCategory: null,
      imageUrl: null,
      materialType: null,
      itemType: null,
      countryOfOrigin: null,
      manufacturerSeriesModel: null,
      gradeClass: null,
      standardNorm: null,
      colourFinish: null,
      size: null,
      pricePerUnit: { toString: () => '12.5000' },
      currency: 'AUD',
      dimensions: null,
      properties: null,
      status: MaterialStatus.PUBLIC,
      companyId: null,
      createdAt: new Date('2026-03-01T10:00:00Z'),
      updatedAt: new Date('2026-03-02T10:00:00Z'),
    };

    it('returns the detail shape for a public material', async () => {
      mockPrisma.material.findUnique.mockResolvedValue(publicMaterial);

      const result = await service.getMaterialById('m-1', companyAdmin);

      expect(result.id).toBe('m-1');
      expect(result.categoryName).toBe('Steel');
      expect(result.pricePerUnit).toBe('12.5000');
      expect(result.createdBy).toEqual({ id: 'u-1', name: 'Jane Admin' });
      expect(result.companyId).toBeNull();
      expect(result.isFavourite).toBe(false);
    });

    it('reports isFavourite=true when the user has favourited the material', async () => {
      mockPrisma.material.findUnique.mockResolvedValue(publicMaterial);
      mockPrisma.materialFavourite.findUnique.mockResolvedValue({ id: 'fav-1' });

      const result = await service.getMaterialById('m-1', companyAdmin);
      expect(result.isFavourite).toBe(true);
      expect(mockPrisma.materialFavourite.findUnique).toHaveBeenCalledWith({
        where: { userId_materialId: { userId: companyAdmin.id, materialId: 'm-1' } },
        select: { id: true },
      });
    });

    it('lets a company see its own non-public private material (US 4.02)', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        ...publicMaterial,
        status: MaterialStatus.PENDING_APPROVAL,
        companyId: companyAdmin.companyId,
      });

      const result = await service.getMaterialById('m-1', companyAdmin);
      expect(result.status).toBe(MaterialStatus.PENDING_APPROVAL);
      expect(result.companyId).toBe(companyAdmin.companyId);
    });

    it('404s a non-public private material owned by another company', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        ...publicMaterial,
        status: MaterialStatus.PENDING_APPROVAL,
        companyId: 'other-co',
      });
      await expect(service.getMaterialById('m-1', companyAdmin)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when the material does not exist', async () => {
      mockPrisma.material.findUnique.mockResolvedValue(null);
      await expect(service.getMaterialById('missing', superAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFound (not leak) for a non-public material requested by a non-SuperAdmin', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        ...publicMaterial,
        status: MaterialStatus.PENDING_APPROVAL,
      });
      await expect(service.getMaterialById('m-1', companyAdmin)).rejects.toThrow(NotFoundException);
    });

    it('allows a SuperAdmin to read a non-public material', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        ...publicMaterial,
        status: MaterialStatus.PENDING_APPROVAL,
      });
      const result = await service.getMaterialById('m-1', superAdmin);
      expect(result.status).toBe(MaterialStatus.PENDING_APPROVAL);
    });
  });

  // ── updateMaterial ─────────────────────────────────────────────────────────

  describe('updateMaterial', () => {
    const loaded = {
      id: 'm-1',
      name: 'Steel Rebar',
      category: { id: 'cat-1', name: 'Steel' },
      createdBy: { id: 'u-1', name: 'Jane Admin' },
      uom: 'kg',
      upc: null,
      manufacturer: null,
      description: null,
      sku: null,
      brand: null,
      manufacturerPartNumber: null,
      subCategory: null,
      imageUrl: null,
      materialType: null,
      itemType: null,
      countryOfOrigin: null,
      manufacturerSeriesModel: null,
      gradeClass: null,
      standardNorm: null,
      colourFinish: null,
      size: null,
      pricePerUnit: null,
      currency: 'AUD',
      dimensions: null,
      properties: null,
      status: MaterialStatus.PUBLIC,
      companyId: null,
      createdAt: new Date('2026-03-01T10:00:00Z'),
      updatedAt: new Date('2026-03-02T10:00:00Z'),
    };

    it('queues a change request for a non-SuperAdmin instead of mutating the material (Phase 3)', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({ ...loaded });
      mockPrisma.materialChangeRequest.create.mockResolvedValue({ id: 'cr-1' });

      await service.updateMaterial('m-1', { description: 'Updated' }, companyAdmin);

      // The live material is untouched; a PENDING change request captures the diff.
      expect(mockPrisma.material.update).not.toHaveBeenCalled();
      expect(mockPrisma.materialChangeRequest.create).toHaveBeenCalledTimes(1);
      const data = mockPrisma.materialChangeRequest.create.mock.calls[0][0].data;
      expect(data.materialId).toBe('m-1');
      expect(data.requestedById).toBe(companyAdmin.id);
      expect(data.changedFields).toEqual({ description: { from: null, to: 'Updated' } });
    });

    it('does not create a change request for a non-SuperAdmin no-op edit', async () => {
      // description already equals the supplied value → empty diff.
      mockPrisma.material.findUnique.mockResolvedValue({ ...loaded, description: 'Same' });

      await service.updateMaterial('m-1', { description: 'Same' }, companyAdmin);

      expect(mockPrisma.materialChangeRequest.create).not.toHaveBeenCalled();
    });

    it('applies a non-SuperAdmin edit DIRECTLY to its own company private draft (US 4.02)', async () => {
      // The company's own non-public row is theirs to edit — no approval queue.
      mockPrisma.material.findUnique.mockResolvedValue({
        ...loaded,
        status: MaterialStatus.PENDING_APPROVAL,
        companyId: companyAdmin.companyId,
      });
      mockPrisma.material.update.mockResolvedValue({
        ...loaded,
        status: MaterialStatus.PENDING_APPROVAL,
        companyId: companyAdmin.companyId,
        description: 'Updated',
      });

      const result = await service.updateMaterial('m-1', { description: 'Updated' }, companyAdmin);

      expect(mockPrisma.material.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.materialChangeRequest.create).not.toHaveBeenCalled();
      expect(result.description).toBe('Updated');
    });

    it('404s (no leak) when a non-SuperAdmin edits another company private material', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        ...loaded,
        status: MaterialStatus.PENDING_APPROVAL,
        companyId: 'other-co',
      });
      await expect(
        service.updateMaterial('m-1', { description: 'x' }, companyAdmin),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.materialChangeRequest.create).not.toHaveBeenCalled();
      expect(mockPrisma.material.update).not.toHaveBeenCalled();
    });

    it('validates the target category up front on a non-SuperAdmin edit', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({ ...loaded });
      mockPrisma.materialCategory.findUnique.mockResolvedValue(null);
      await expect(
        service.updateMaterial('m-1', { categoryId: 'cat-missing' }, companyAdmin),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.materialChangeRequest.create).not.toHaveBeenCalled();
    });

    it('throws NotFound when the material does not exist', async () => {
      mockPrisma.material.findUnique.mockResolvedValue(null);
      await expect(
        service.updateMaterial('missing', { description: 'x' }, superAdmin),
      ).rejects.toThrow(NotFoundException);
    });

    it('applies only the supplied fields and returns the detail shape', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({ ...loaded });
      mockPrisma.material.update.mockResolvedValue({
        ...loaded,
        description: 'Updated',
        materialType: 'Bar',
      });

      const result = await service.updateMaterial(
        'm-1',
        { description: 'Updated', materialType: 'Bar' },
        superAdmin,
      );

      const data = mockPrisma.material.update.mock.calls[0][0].data;
      expect(data).toEqual({ description: 'Updated', materialType: 'Bar' });
      expect(data.name).toBeUndefined();
      expect(result.description).toBe('Updated');
      expect(result.materialType).toBe('Bar');
    });

    it('connects a new category when categoryId is provided and valid', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({ ...loaded });
      mockPrisma.materialCategory.findUnique.mockResolvedValue({ id: 'cat-2', name: 'Timber' });
      mockPrisma.material.update.mockResolvedValue({
        ...loaded,
        category: { id: 'cat-2', name: 'Timber' },
      });

      await service.updateMaterial('m-1', { categoryId: 'cat-2' }, superAdmin);

      const data = mockPrisma.material.update.mock.calls[0][0].data;
      expect(data.category).toEqual({ connect: { id: 'cat-2' } });
    });

    it('throws NotFound when the new category does not exist', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({ ...loaded });
      mockPrisma.materialCategory.findUnique.mockResolvedValue(null);
      await expect(
        service.updateMaterial('m-1', { categoryId: 'cat-missing' }, superAdmin),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws Conflict on a case-insensitive duplicate rename (excluding self)', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({ ...loaded });
      mockPrisma.material.findFirst.mockResolvedValue({ id: 'other' });
      await expect(
        service.updateMaterial('m-1', { name: 'STEEL REBAR 2' }, superAdmin),
      ).rejects.toThrow(ConflictException);
    });

    it('does not re-check duplicates when the name is unchanged (case-insensitive)', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({ ...loaded });
      mockPrisma.material.update.mockResolvedValue({ ...loaded });
      await service.updateMaterial('m-1', { name: 'steel rebar' }, superAdmin);
      expect(mockPrisma.material.findFirst).not.toHaveBeenCalled();
    });

    it('applies pricePerUnit, dimensions and properties on a SuperAdmin update', async () => {
      const dims = { length: { value: 100, uom: 'mm' } };
      const props = { density: '1234' };
      mockPrisma.material.findUnique.mockResolvedValue({ ...loaded });
      mockPrisma.material.update.mockResolvedValue({
        ...loaded,
        pricePerUnit: { toString: () => '42.5' },
        dimensions: dims,
        properties: props,
      });

      const result = await service.updateMaterial(
        'm-1',
        { pricePerUnit: 42.5, dimensions: dims, properties: props },
        superAdmin,
      );

      const data = mockPrisma.material.update.mock.calls[0][0].data;
      expect(data.pricePerUnit).toBe(42.5);
      expect(data.dimensions).toEqual(dims);
      expect(data.properties).toEqual(props);
      expect(result.pricePerUnit).toBe('42.5');
      expect(result.dimensions).toEqual(dims);
      expect(result.properties).toEqual(props);
    });

    it('captures pricePerUnit, dimensions and properties diffs in a non-SuperAdmin change request', async () => {
      const dims = { length: { value: 100, uom: 'mm' } };
      const props = { density: '1234' };
      mockPrisma.material.findUnique.mockResolvedValue({
        ...loaded,
        pricePerUnit: 12.5,
        dimensions: null,
        properties: null,
      });
      mockPrisma.materialChangeRequest.create.mockResolvedValue({ id: 'cr-2' });

      await service.updateMaterial(
        'm-1',
        { pricePerUnit: 42.5, dimensions: dims, properties: props },
        companyAdmin,
      );

      expect(mockPrisma.material.update).not.toHaveBeenCalled();
      const data = mockPrisma.materialChangeRequest.create.mock.calls[0][0].data;
      expect(data.changedFields).toEqual({
        pricePerUnit: { from: 12.5, to: 42.5 },
        dimensions: { from: null, to: dims },
        properties: { from: null, to: props },
      });
    });

    it('captures a categoryId change in a non-SuperAdmin change request', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({ ...loaded, categoryId: 'cat-1' });
      mockPrisma.materialCategory.findUnique.mockResolvedValue({ id: 'cat-2', name: 'Timber' });
      mockPrisma.materialChangeRequest.create.mockResolvedValue({ id: 'cr-3' });

      await service.updateMaterial('m-1', { categoryId: 'cat-2' }, companyAdmin);

      const data = mockPrisma.materialChangeRequest.create.mock.calls[0][0].data;
      expect(data.changedFields).toEqual({ categoryId: { from: 'cat-1', to: 'cat-2' } });
    });

    it('diffs a first-time price against a null current and ignores unchanged JSON fields', async () => {
      const dims = { length: { value: 100, uom: 'mm' } };
      const props = { density: '1234' };
      // pricePerUnit is null on the current row (first-time price), while the
      // supplied dimensions/properties are identical to the current values — a
      // no-op that must not appear in the diff.
      mockPrisma.material.findUnique.mockResolvedValue({
        ...loaded,
        dimensions: dims,
        properties: props,
      });
      mockPrisma.materialChangeRequest.create.mockResolvedValue({ id: 'cr-4' });

      await service.updateMaterial(
        'm-1',
        { pricePerUnit: 42.5, dimensions: dims, properties: props },
        companyAdmin,
      );

      const data = mockPrisma.materialChangeRequest.create.mock.calls[0][0].data;
      expect(data.changedFields).toEqual({ pricePerUnit: { from: null, to: 42.5 } });
    });
  });

  // ── deleteMaterial ─────────────────────────────────────────────────────────

  describe('deleteMaterial', () => {
    const noReferences = () => {
      mockPrisma.poLineItem.count.mockResolvedValue(0);
      mockPrisma.rfqLineItem.count.mockResolvedValue(0);
      mockPrisma.quoteResponseLineItem.count.mockResolvedValue(0);
      mockPrisma.bomItem.count.mockResolvedValue(0);
      mockPrisma.materialListItem.count.mockResolvedValue(0);
    };

    it('throws Forbidden for a non-SuperAdmin', async () => {
      await expect(service.deleteMaterial('m-1', companyAdmin)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFound when the material does not exist', async () => {
      mockPrisma.material.findUnique.mockResolvedValue(null);
      await expect(service.deleteMaterial('missing', superAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws Conflict when the material is referenced by any document', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({ id: 'm-1' });
      noReferences();
      mockPrisma.rfqLineItem.count.mockResolvedValue(2);

      await expect(service.deleteMaterial('m-1', superAdmin)).rejects.toThrow(ConflictException);
      expect(mockPrisma.material.delete).not.toHaveBeenCalled();
    });

    it('deletes when the material has no references', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({ id: 'm-1' });
      noReferences();
      mockPrisma.material.delete.mockResolvedValue({});

      const result = await service.deleteMaterial('m-1', superAdmin);

      expect(mockPrisma.material.delete).toHaveBeenCalledWith({ where: { id: 'm-1' } });
      expect(result).toEqual({ success: true });
    });
  });

  // ── detectDuplicates ───────────────────────────────────────────────────────

  describe('detectDuplicates', () => {
    it('returns empty results for no candidates', async () => {
      const res = await service.detectDuplicates({ candidates: [] } as never, companyAdmin);
      expect(res).toEqual({ results: [] });
      expect(mockPrisma.material.findMany).not.toHaveBeenCalled();
    });

    it('returns empty results when no candidate carries any identity field', async () => {
      const res = await service.detectDuplicates(
        {
          candidates: [{ name: '   ' }],
        } as never,
        companyAdmin,
      );
      expect(res).toEqual({ results: [] });
      expect(mockPrisma.material.findMany).not.toHaveBeenCalled();
    });

    it('scopes the catalogue query to public OR the user company-private rows (US 4.02)', async () => {
      mockPrisma.material.findMany.mockResolvedValue([]);
      await service.detectDuplicates(
        { candidates: [{ name: 'Cable', sku: 'SK-1', upc: '111' }] } as never,
        companyAdmin,
      );

      const where = mockPrisma.material.findMany.mock.calls[0][0].where;
      // The name/sku/upc OR is AND-ed with the visibility envelope.
      expect(where.AND).toHaveLength(2);
      expect(where.AND[1]).toEqual({
        OR: [{ status: MaterialStatus.PUBLIC }, { companyId: companyAdmin.companyId }],
      });
    });

    it('matches on case-insensitive name (via nameCi), sku and upc, keyed by index', async () => {
      mockPrisma.material.findMany.mockResolvedValue([
        {
          id: 'mat-1',
          name: 'Portland Cement',
          nameCi: 'portland cement',
          sku: 'CEM-001',
          upc: null,
          status: MaterialStatus.PUBLIC,
        },
        {
          id: 'mat-2',
          name: 'Rebar',
          nameCi: 'rebar',
          sku: null,
          upc: '999',
          status: MaterialStatus.PUBLIC,
        },
      ]);

      const res = await service.detectDuplicates(
        {
          candidates: [
            { name: 'PORTLAND CEMENT', sku: 'CEM-001', upc: null }, // matches mat-1 by name+sku
            { name: 'Brand New Item', sku: null, upc: '999' }, // matches mat-2 by upc
            { name: 'Totally Unique', sku: 'ZZZ', upc: null }, // no match
          ],
        } as never,
        companyAdmin,
      );

      // Only the colliding candidates appear, in original-index order.
      expect(res.results).toHaveLength(2);
      const [first, second] = res.results;
      expect(first.index).toBe(0);
      expect(first.matches).toHaveLength(1);
      expect(first.matches[0].id).toBe('mat-1');
      expect(first.matches[0].code).toBe('CEM-001'); // SKU used as display code
      expect([...first.matches[0].matchedOn].sort()).toEqual(['name', 'sku']);

      expect(second.index).toBe(1);
      expect(second.matches[0].id).toBe('mat-2');
      expect(second.matches[0].matchedOn).toEqual(['upc']);
      // No SKU → derived MAT- code.
      expect(second.matches[0].code).toMatch(/^MAT-/);
    });
  });

  // ── change requests ─────────────────────────────────────────────────────────

  describe('listChangeRequests', () => {
    it('serializes diffs, resolving categoryId to a category name', async () => {
      mockPrisma.materialChangeRequest.findMany.mockResolvedValue([
        {
          id: 'cr-1',
          status: 'PENDING',
          reason: null,
          resolvedAt: null,
          createdAt: new Date('2026-06-12T10:00:00Z'),
          changedFields: {
            description: { from: 'old', to: 'new' },
            categoryId: { from: 'cat-1', to: 'cat-2' },
            dimensions: { from: null, to: { length: { value: 1, uom: 'mm' } } },
          },
          material: { id: 'm-1', name: 'Steel Rebar' },
          requestedBy: { id: 'ca-1', name: 'Cara Admin' },
          resolvedBy: null,
        },
      ]);
      mockPrisma.materialCategory.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Steel' },
        { id: 'cat-2', name: 'Timber' },
      ]);

      const res = await service.listChangeRequests('PENDING' as never);

      expect(res).toHaveLength(1);
      expect(res[0].materialName).toBe('Steel Rebar');
      expect(res[0].changes.description).toEqual({ from: 'old', to: 'new' });
      // categoryId diff is presented as friendly category names under `category`.
      expect(res[0].changes.category).toEqual({ from: 'Steel', to: 'Timber' });
      // structured JSON fields collapse to a terse marker.
      expect(res[0].changes.dimensions).toEqual({ from: null, to: 'Updated' });
      expect(res[0].requestedBy).toEqual({ id: 'ca-1', name: 'Cara Admin' });
    });

    it('coerces boolean and non-scalar diff values defensively', async () => {
      mockPrisma.materialChangeRequest.findMany.mockResolvedValue([
        {
          id: 'cr-9',
          status: 'PENDING',
          reason: null,
          resolvedAt: null,
          createdAt: new Date('2026-06-12T10:00:00Z'),
          changedFields: {
            manufacturer: { from: true, to: false },
            sku: { from: { nested: 1 }, to: [1, 2] },
          },
          material: { id: 'm-1', name: 'Steel Rebar' },
          requestedBy: null,
          resolvedBy: null,
        },
      ]);

      const res = await service.listChangeRequests('PENDING' as never);

      // Booleans coerce to their string form; non-scalars serialize as JSON
      // rather than leaking "[object Object]".
      expect(res[0].changes.manufacturer).toEqual({ from: 'true', to: 'false' });
      expect(res[0].changes.sku).toEqual({ from: '{"nested":1}', to: '[1,2]' });
      expect(res[0].requestedBy).toBeNull();
    });
  });

  describe('approveChangeRequest', () => {
    it('applies the stored diff to the material and marks the request APPROVED', async () => {
      mockPrisma.materialChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        materialId: 'm-1',
        status: 'PENDING',
        changedFields: { description: { from: 'old', to: 'new desc' } },
      });
      // applyMaterialUpdate path
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        name: 'Steel Rebar',
        status: MaterialStatus.PUBLIC,
      });
      mockPrisma.material.update.mockResolvedValue({
        id: 'm-1',
        name: 'Steel Rebar',
        category: { id: 'cat-1', name: 'Steel' },
        createdBy: null,
        description: 'new desc',
        pricePerUnit: null,
        currency: 'AUD',
        dimensions: null,
        properties: null,
        status: MaterialStatus.PUBLIC,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.materialChangeRequest.update.mockResolvedValue({
        id: 'cr-1',
        status: 'APPROVED',
        reason: null,
        resolvedAt: new Date('2026-06-12T12:00:00Z'),
        createdAt: new Date('2026-06-12T10:00:00Z'),
        changedFields: { description: { from: 'old', to: 'new desc' } },
        material: { id: 'm-1', name: 'Steel Rebar' },
        requestedBy: { id: 'ca-1', name: 'Cara Admin' },
        resolvedBy: { id: 'sa-1', name: 'Super Admin' },
      });

      const res = await service.approveChangeRequest('cr-1', superAdmin);

      // The material was actually updated with the proposed value.
      const data = mockPrisma.material.update.mock.calls[0][0].data;
      expect(data.description).toBe('new desc');
      expect(mockPrisma.materialChangeRequest.update.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ status: 'APPROVED', resolvedById: 'sa-1' }),
      );
      expect(res.status).toBe('APPROVED');
      expect(res.resolvedBy).toEqual({ id: 'sa-1', name: 'Super Admin' });
    });

    it('throws NotFound when the change request is missing', async () => {
      mockPrisma.materialChangeRequest.findUnique.mockResolvedValue(null);
      await expect(service.approveChangeRequest('missing', superAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFound when the underlying material was deleted before approval', async () => {
      mockPrisma.materialChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        materialId: 'm-gone',
        status: 'PENDING',
        changedFields: { description: { from: 'old', to: 'new' } },
      });
      // applyMaterialUpdate re-loads the material with no `existing` hint → null.
      mockPrisma.material.findUnique.mockResolvedValue(null);

      await expect(service.approveChangeRequest('cr-1', superAdmin)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.materialChangeRequest.update).not.toHaveBeenCalled();
    });

    it('throws BadRequest when the change request is already resolved', async () => {
      mockPrisma.materialChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        status: 'APPROVED',
        changedFields: {},
      });
      await expect(service.approveChangeRequest('cr-1', superAdmin)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.material.update).not.toHaveBeenCalled();
    });
  });

  describe('rejectChangeRequest', () => {
    it('marks the request REJECTED with a reason and leaves the material untouched', async () => {
      mockPrisma.materialChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        status: 'PENDING',
        changedFields: { description: { from: 'a', to: 'b' } },
      });
      mockPrisma.materialChangeRequest.update.mockResolvedValue({
        id: 'cr-1',
        status: 'REJECTED',
        reason: 'Not accurate',
        resolvedAt: new Date('2026-06-12T12:00:00Z'),
        createdAt: new Date('2026-06-12T10:00:00Z'),
        changedFields: { description: { from: 'a', to: 'b' } },
        material: { id: 'm-1', name: 'Steel Rebar' },
        requestedBy: { id: 'ca-1', name: 'Cara Admin' },
        resolvedBy: { id: 'sa-1', name: 'Super Admin' },
      });

      const res = await service.rejectChangeRequest('cr-1', { reason: 'Not accurate' }, superAdmin);

      expect(mockPrisma.material.update).not.toHaveBeenCalled();
      expect(mockPrisma.materialChangeRequest.update.mock.calls[0][0].data).toEqual(
        expect.objectContaining({
          status: 'REJECTED',
          reason: 'Not accurate',
          resolvedById: 'sa-1',
        }),
      );
      expect(res.status).toBe('REJECTED');
      expect(res.reason).toBe('Not accurate');
    });

    it('throws BadRequest when the request is not pending', async () => {
      mockPrisma.materialChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        status: 'REJECTED',
        changedFields: {},
      });
      await expect(service.rejectChangeRequest('cr-1', {}, superAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('resolves categoryId diffs to category names when serializing the resolved request', async () => {
      mockPrisma.materialChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        status: 'PENDING',
        changedFields: { categoryId: { from: 'cat-1', to: 'cat-2' } },
      });
      mockPrisma.materialChangeRequest.update.mockResolvedValue({
        id: 'cr-1',
        status: 'REJECTED',
        reason: null,
        resolvedAt: new Date('2026-06-12T12:00:00Z'),
        createdAt: new Date('2026-06-12T10:00:00Z'),
        changedFields: { categoryId: { from: 'cat-1', to: 'cat-2' } },
        material: { id: 'm-1', name: 'Steel Rebar' },
        requestedBy: { id: 'ca-1', name: 'Cara Admin' },
        resolvedBy: { id: 'sa-1', name: 'Super Admin' },
      });
      mockPrisma.materialCategory.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Steel' },
        { id: 'cat-2', name: 'Timber' },
      ]);

      const res = await service.rejectChangeRequest('cr-1', {}, superAdmin);

      expect(res.changes.category).toEqual({ from: 'Steel', to: 'Timber' });
    });
  });

  // ── favourites (US 4.03) ─────────────────────────────────────────────────────

  describe('addFavourite', () => {
    it('upserts a favourite for a visible (public) material — idempotent', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.PUBLIC,
        companyId: null,
      });
      mockPrisma.materialFavourite.upsert.mockResolvedValue({ id: 'fav-1' });

      const res = await service.addFavourite('m-1', companyAdmin);

      expect(res).toEqual({ success: true });
      expect(mockPrisma.materialFavourite.upsert).toHaveBeenCalledWith({
        where: { userId_materialId: { userId: companyAdmin.id, materialId: 'm-1' } },
        create: { userId: companyAdmin.id, materialId: 'm-1' },
        update: {},
      });
    });

    it('lets a company favourite its own private material', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.PENDING_APPROVAL,
        companyId: companyAdmin.companyId,
      });
      mockPrisma.materialFavourite.upsert.mockResolvedValue({ id: 'fav-2' });

      await expect(service.addFavourite('m-1', companyAdmin)).resolves.toEqual({ success: true });
    });

    it('404s when the material does not exist', async () => {
      mockPrisma.material.findUnique.mockResolvedValue(null);
      await expect(service.addFavourite('missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.materialFavourite.upsert).not.toHaveBeenCalled();
    });

    it('404s (no leak) when favouriting another company private material', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.PENDING_APPROVAL,
        companyId: 'other-co',
      });
      await expect(service.addFavourite('m-1', companyAdmin)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.materialFavourite.upsert).not.toHaveBeenCalled();
    });
  });

  describe('removeFavourite', () => {
    it('deletes the favourite (no-op safe via deleteMany)', async () => {
      mockPrisma.materialFavourite.deleteMany.mockResolvedValue({ count: 1 });

      const res = await service.removeFavourite('m-1', companyAdmin);

      expect(res).toEqual({ success: true });
      expect(mockPrisma.materialFavourite.deleteMany).toHaveBeenCalledWith({
        where: { userId: companyAdmin.id, materialId: 'm-1' },
      });
    });

    it('succeeds even when nothing was favourited', async () => {
      mockPrisma.materialFavourite.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.removeFavourite('m-1', companyAdmin)).resolves.toEqual({
        success: true,
      });
    });
  });
});
