import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';

import { VendorsService } from '../vendors.service';

const mockPrisma = {
  companyVendorAssignment: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
  },
  company: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  warehouseLocation: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
};

const companyAdmin = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};

const vendorUser = {
  id: 'vu-1',
  email: 'vendor@test.com',
  role: UserRole.VENDOR,
  companyId: 'vendor-comp-1',
};

const makeAssignment = (overrides = {}) => ({
  id: 'assign-1',
  categories: [],
  vendor: {
    id: 'v-1',
    legalName: 'VendorCo',
    contactEmail: 'vendor@co.com',
    specialisations: [],
    users: [
      {
        id: 'u-1',
        name: 'Vendor User',
        email: 'vendor@co.com',
        status: UserStatus.ACTIVE,
        createdAt: new Date('2026-03-01'),
      },
    ],
  },
  assignedAt: new Date('2026-03-01'),
  ...overrides,
});

describe('VendorsService', () => {
  let service: VendorsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VendorsService(mockPrisma as never);
  });

  // ── listVendors ─────────────────────────────────────────────────────────

  it('returns empty list when user has no companyId', async () => {
    const result = await service.listVendors({} as never, {
      id: 'u-1',
      role: 'VENDOR',
      companyId: null,
    });
    expect(result.items).toEqual([]);
    expect(result.meta.total).toBe(0);
  });

  it('returns vendors with ACTIVE status', async () => {
    mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([makeAssignment()]);

    const result = await service.listVendors({} as never, companyAdmin);
    expect(result.items).toHaveLength(1);
    expect((result.items[0] as any).companyName).toBe('VendorCo');
    expect((result.items[0] as any).status).toBe('ACTIVE');
    expect((result.items[0] as any).contactName).toBe('Vendor User');
  });

  it('derives INVITED status from non-ACTIVE user', async () => {
    mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([
      makeAssignment({
        vendor: {
          id: 'v-2',
          legalName: 'NewVendor',
          contactEmail: 'new@vendor.com',
          specialisations: [],
          users: [
            {
              id: 'u-2',
              name: 'New',
              email: 'new@vendor.com',
              status: UserStatus.INVITED,
              createdAt: new Date('2026-03-10'),
            },
          ],
        },
      }),
    ]);

    const result = await service.listVendors({} as never, companyAdmin);
    expect((result.items[0] as any).status).toBe('INVITED');
  });

  it('handles vendor with no users', async () => {
    mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([
      makeAssignment({
        vendor: {
          id: 'v-3',
          legalName: 'EmptyVendor',
          contactEmail: 'e@v.com',
          specialisations: [],
          users: [],
        },
      }),
    ]);

    const result = await service.listVendors({} as never, companyAdmin);
    expect((result.items[0] as any).contactName).toBeNull();
    expect((result.items[0] as any).status).toBe('INVITED');
  });

  it('returns one row per company with representatives array', async () => {
    mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([
      makeAssignment({
        vendor: {
          id: 'v-1',
          legalName: 'VendorCo',
          contactEmail: 'vendor@co.com',
          specialisations: [],
          users: [
            {
              id: 'u-1',
              name: 'User One',
              email: 'one@co.com',
              status: UserStatus.ACTIVE,
              createdAt: new Date('2026-03-01'),
            },
            {
              id: 'u-2',
              name: 'User Two',
              email: 'two@co.com',
              status: UserStatus.INVITED,
              createdAt: new Date('2026-03-15'),
            },
          ],
        },
      }),
    ]);

    const result = await service.listVendors({} as never, companyAdmin);
    expect(result.items).toHaveLength(1);
    const item = result.items[0] as any;
    expect(item.contactName).toBe('User One');
    expect(item.status).toBe('ACTIVE');
    expect(item.representatives).toHaveLength(2);
    expect(item.representatives[0].name).toBe('User One');
    expect(item.representatives[1].name).toBe('User Two');
    expect(item.representatives[1].status).toBe('INVITED');
  });

  it('applies search filter', async () => {
    mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([]);

    await service.listVendors({ search: 'test' } as never, companyAdmin);
    const where = mockPrisma.companyVendorAssignment.findMany.mock.calls[0][0].where;
    expect(where.vendor.OR).toHaveLength(2);
  });

  it('applies specialisation filter with hasSome', async () => {
    mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([]);

    await service.listVendors({ specialisation: 'Steel, Concrete' } as never, companyAdmin);
    const where = mockPrisma.companyVendorAssignment.findMany.mock.calls[0][0].where;
    expect(where.vendor.specialisations).toEqual({ hasSome: ['Steel', 'Concrete'] });
  });

  it('applies dateFrom filter', async () => {
    mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([]);

    await service.listVendors({ dateFrom: '2026-01-01' } as never, companyAdmin);
    const where = mockPrisma.companyVendorAssignment.findMany.mock.calls[0][0].where;
    expect(where.assignedAt.gte).toEqual(new Date('2026-01-01'));
    expect(where.assignedAt.lte).toBeUndefined();
  });

  it('applies dateTo filter with end-of-day', async () => {
    mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([]);

    await service.listVendors({ dateTo: '2026-01-31' } as never, companyAdmin);
    const where = mockPrisma.companyVendorAssignment.findMany.mock.calls[0][0].where;
    expect(where.assignedAt.lte.getHours()).toBe(23);
    expect(where.assignedAt.lte.getMinutes()).toBe(59);
    expect(where.assignedAt.gte).toBeUndefined();
  });

  it('applies both dateFrom and dateTo filters', async () => {
    mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([]);

    await service.listVendors(
      { dateFrom: '2026-01-01', dateTo: '2026-01-31' } as never,
      companyAdmin,
    );
    const where = mockPrisma.companyVendorAssignment.findMany.mock.calls[0][0].where;
    expect(where.assignedAt.gte).toEqual(new Date('2026-01-01'));
    expect(where.assignedAt.lte).toBeDefined();
  });

  it('filters by status post-query', async () => {
    mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([
      makeAssignment(),
      makeAssignment({
        id: 'assign-2',
        vendor: {
          id: 'v-2',
          legalName: 'InvitedVendor',
          contactEmail: 'i@v.com',
          specialisations: [],
          users: [
            {
              id: 'u-2',
              name: 'Inv',
              email: 'i@v.com',
              status: UserStatus.INVITED,
              createdAt: new Date('2026-03-20'),
            },
          ],
        },
      }),
    ]);

    const result = await service.listVendors({ status: 'ACTIVE' } as never, companyAdmin);
    expect(result.items).toHaveLength(1);
    expect((result.items[0] as any).status).toBe('ACTIVE');
    expect(result.meta.total).toBe(1);
  });

  it('paginates by company count', async () => {
    const assignments = Array.from({ length: 5 }, (_, i) =>
      makeAssignment({
        id: `assign-${i}`,
        vendor: {
          id: `v-${i}`,
          legalName: `Vendor ${i}`,
          contactEmail: `v${i}@co.com`,
          specialisations: [],
          users: [
            {
              id: `u-${i}`,
              name: `User ${i}`,
              email: `u${i}@co.com`,
              status: UserStatus.ACTIVE,
              createdAt: new Date('2026-03-01'),
            },
          ],
        },
      }),
    );
    mockPrisma.companyVendorAssignment.findMany.mockResolvedValue(assignments);

    const result = await service.listVendors({ page: 1, limit: 3 } as never, companyAdmin);
    expect(result.items).toHaveLength(3);
    expect(result.meta).toEqual({ page: 1, limit: 3, total: 5, totalPages: 2 });
  });

  // ── getVendorProfile ────────────────────────────────────────────────────

  describe('getVendorProfile', () => {
    it('throws NotFoundException when vendor not found', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);
      await expect(service.getVendorProfile('missing', vendorUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when vendor user accesses different company', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'other-comp',
        type: 'VENDOR',
        users: [],
        warehouseLocations: [],
        documents: [],
      });
      await expect(service.getVendorProfile('other-comp', vendorUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns vendor profile for own company', async () => {
      const profile = {
        id: 'vendor-comp-1',
        type: 'VENDOR',
        legalName: 'VendorCo',
        users: [{ id: 'vu-1', name: 'Vendor User' }],
        warehouseLocations: [],
        documents: [],
      };
      mockPrisma.company.findFirst.mockResolvedValue(profile);
      const result = await service.getVendorProfile('vendor-comp-1', vendorUser);
      expect(result).toEqual(profile);
    });

    it('allows contractor to see assigned vendor profile', async () => {
      const profile = {
        id: 'vendor-comp-1',
        type: 'VENDOR',
        legalName: 'VendorCo',
        users: [],
        warehouseLocations: [],
        documents: [],
      };
      mockPrisma.company.findFirst.mockResolvedValue(profile);
      mockPrisma.companyVendorAssignment.findFirst.mockResolvedValue({ id: 'assign-1' });

      const result = await service.getVendorProfile('vendor-comp-1', companyAdmin);
      expect(result).toEqual(profile);
    });

    it('throws ForbiddenException when contractor has no companyId', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'vendor-comp-1',
        type: 'VENDOR',
        users: [],
        warehouseLocations: [],
        documents: [],
      });

      const userWithoutCompany = {
        id: 'u-1',
        email: 'po@test.com',
        role: UserRole.PROCUREMENT_OFFICER,
        companyId: null,
      };
      await expect(
        service.getVendorProfile('vendor-comp-1', userWithoutCompany as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when contractor has no assignment', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'vendor-comp-1',
        type: 'VENDOR',
        users: [],
        warehouseLocations: [],
        documents: [],
      });
      mockPrisma.companyVendorAssignment.findFirst.mockResolvedValue(null);

      await expect(service.getVendorProfile('vendor-comp-1', companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── updateVendorProfile ─────────────────────────────────────────────────

  describe('updateVendorProfile', () => {
    it('throws NotFoundException when vendor not found', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);
      await expect(
        service.updateVendorProfile('missing', { legalName: 'New' }, vendorUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates vendor profile fields', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'vendor-comp-1', type: 'VENDOR' });
      mockPrisma.company.update.mockResolvedValue({ id: 'vendor-comp-1', legalName: 'Updated' });

      const result = await service.updateVendorProfile(
        'vendor-comp-1',
        { legalName: 'Updated', website: 'https://vendor.com' },
        vendorUser,
      );
      expect(result.legalName).toBe('Updated');
      expect(mockPrisma.company.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'vendor-comp-1' },
          data: expect.objectContaining({ legalName: 'Updated', website: 'https://vendor.com' }),
        }),
      );
    });

    it('updates all optional fields when all are provided', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'vendor-comp-1', type: 'VENDOR' });
      const fullDto = {
        legalName: 'Updated Legal',
        tradeName: 'Updated Trade',
        abn: '12345678901',
        taxCode: '999',
        legalAddress: '123 Updated St',
        contactEmail: 'updated@vendor.com',
        contactPhone: '+61400000000',
        website: 'https://updated-vendor.com',
        specialisations: ['Steel', 'Concrete', 'Timber'],
      };
      mockPrisma.company.update.mockResolvedValue({ id: 'vendor-comp-1', ...fullDto });

      const result = await service.updateVendorProfile('vendor-comp-1', fullDto, vendorUser);

      expect(result.id).toBe('vendor-comp-1');
      expect(mockPrisma.company.update).toHaveBeenCalledWith({
        where: { id: 'vendor-comp-1' },
        data: {
          legalName: 'Updated Legal',
          tradeName: 'Updated Trade',
          abn: '12345678901',
          taxCode: '999',
          legalAddress: '123 Updated St',
          contactEmail: 'updated@vendor.com',
          contactPhone: '+61400000000',
          website: 'https://updated-vendor.com',
          specialisations: ['Steel', 'Concrete', 'Timber'],
        },
      });
    });
  });

  // ── Warehouses ──────────────────────────────────────────────────────────

  describe('addWarehouse', () => {
    it('throws NotFoundException when vendor not found', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);
      await expect(
        service.addWarehouse(
          'missing',
          { name: 'WH', city: 'Syd', postcode: '2000', address: '123 St' },
          vendorUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a warehouse location', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'vendor-comp-1', type: 'VENDOR' });
      const whData = { name: 'Main WH', city: 'Sydney', postcode: '2000', address: '123 Main St' };
      mockPrisma.warehouseLocation.create.mockResolvedValue({ id: 'wh-1', ...whData });

      const result = await service.addWarehouse('vendor-comp-1', whData, vendorUser);
      expect(result.id).toBe('wh-1');
      expect(mockPrisma.warehouseLocation.create).toHaveBeenCalledWith({
        data: { companyId: 'vendor-comp-1', ...whData },
      });
    });
  });

  describe('updateWarehouse', () => {
    it('throws NotFoundException when vendor company not found', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);

      await expect(
        service.updateWarehouse(
          'missing',
          'wh-1',
          { name: 'Updated', city: 'Mel', postcode: '3000', address: '456 St' },
          vendorUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when warehouse not found', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'vendor-comp-1', type: 'VENDOR' });
      mockPrisma.warehouseLocation.findFirst.mockResolvedValue(null);

      await expect(
        service.updateWarehouse(
          'vendor-comp-1',
          'wh-missing',
          { name: 'Updated', city: 'Mel', postcode: '3000', address: '456 St' },
          vendorUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates a warehouse location', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'vendor-comp-1', type: 'VENDOR' });
      mockPrisma.warehouseLocation.findFirst.mockResolvedValue({ id: 'wh-1' });
      const dto = { name: 'Updated', city: 'Melbourne', postcode: '3000', address: '456 Other' };
      mockPrisma.warehouseLocation.update.mockResolvedValue({ id: 'wh-1', ...dto });

      const result = await service.updateWarehouse('vendor-comp-1', 'wh-1', dto, vendorUser);
      expect(result.name).toBe('Updated');
    });
  });

  describe('deleteWarehouse', () => {
    it('throws NotFoundException when vendor company not found', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);

      await expect(service.deleteWarehouse('missing', 'wh-1', vendorUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when warehouse not found', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'vendor-comp-1', type: 'VENDOR' });
      mockPrisma.warehouseLocation.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteWarehouse('vendor-comp-1', 'wh-missing', vendorUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes a warehouse location', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'vendor-comp-1', type: 'VENDOR' });
      mockPrisma.warehouseLocation.findFirst.mockResolvedValue({ id: 'wh-1' });
      mockPrisma.warehouseLocation.delete.mockResolvedValue({});

      const result = await service.deleteWarehouse('vendor-comp-1', 'wh-1', vendorUser);
      expect(result).toEqual({ success: true });
      expect(mockPrisma.warehouseLocation.delete).toHaveBeenCalledWith({
        where: { id: 'wh-1' },
      });
    });
  });

  // ── getRepresentatives (US-3.12) ────────────────────────────────────────

  describe('getRepresentatives', () => {
    it('throws NotFoundException when vendor not found', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);
      await expect(service.getRepresentatives('missing', vendorUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns vendor users', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'vendor-comp-1', type: 'VENDOR' });
      const users = [
        {
          id: 'u-1',
          name: 'Rep 1',
          email: 'rep1@v.com',
          phone: null,
          position: 'Manager',
          role: 'VENDOR',
        },
        {
          id: 'u-2',
          name: 'Rep 2',
          email: 'rep2@v.com',
          phone: '123',
          position: 'Sales',
          role: 'VENDOR',
        },
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const result = await service.getRepresentatives('vendor-comp-1', vendorUser);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Rep 1');
    });

    it('allows contractor to view representatives of assigned vendor', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'vendor-comp-1', type: 'VENDOR' });
      mockPrisma.companyVendorAssignment.findFirst.mockResolvedValue({ id: 'assign-1' });
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.getRepresentatives('vendor-comp-1', companyAdmin);
      expect(result).toEqual([]);
    });
  });
});
