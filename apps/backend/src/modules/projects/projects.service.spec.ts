import { ProjectListQueryDto } from '@forethread/shared-types';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectStatus, UserRole } from '@prisma/client';

import { ProjectsService } from './projects.service';

/** Build a query object that satisfies the DTO (including computed skip/take). */
function q(overrides: Partial<ProjectListQueryDto> = {}): ProjectListQueryDto {
  return Object.assign(new ProjectListQueryDto(), overrides);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const validLocations = [
  { type: 'DELIVERY' as const, address: '123 Main St', isDefault: true },
  { type: 'STORAGE' as const, address: '456 Warehouse Ave', isDefault: true },
];

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
const procOfficer = {
  id: 'po-1',
  email: 'po@test.com',
  role: UserRole.PROCUREMENT_OFFICER,
  companyId: 'comp-1',
};

// ── Mock PrismaService ───────────────────────────────────────────────────────

const mockTx = {
  project: {
    create: jest.fn(),
    update: jest.fn(),
  },
  projectLocation: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
};

const mockPrisma = {
  project: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  projectMember: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  $transaction: jest
    .fn()
    .mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
      return cb(mockTx);
    }),
};

describe('ProjectsService', () => {
  let service: ProjectsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProjectsService(mockPrisma as never);

    // Default: validateCompanyUsers passes
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'po-1' }, { id: 'ca-1' }]);
  });

  // ── listProjects ───────────────────────────────────────────────────────

  describe('listProjects', () => {
    beforeEach(() => {
      mockPrisma.project.findMany.mockResolvedValue([]);
      mockPrisma.project.count.mockResolvedValue(0);
    });

    it('SuperAdmin sees all projects (no companyId filter)', async () => {
      await service.listProjects(q(), superAdmin);
      const whereArg = mockPrisma.project.findMany.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('companyId');
      expect(whereArg).not.toHaveProperty('members');
    });

    it('CompanyAdmin scopes to own company', async () => {
      await service.listProjects(q(), companyAdmin);
      const whereArg = mockPrisma.project.findMany.mock.calls[0][0].where;
      expect(whereArg.companyId).toBe('comp-1');
      expect(whereArg).not.toHaveProperty('members');
    });

    it('other roles scope to own company and membership', async () => {
      await service.listProjects(q(), procOfficer);
      const whereArg = mockPrisma.project.findMany.mock.calls[0][0].where;
      expect(whereArg.companyId).toBe('comp-1');
      expect(whereArg.members).toEqual({ some: { userId: 'po-1' } });
    });

    it('excludes Archived by default', async () => {
      await service.listProjects(q(), superAdmin);
      const whereArg = mockPrisma.project.findMany.mock.calls[0][0].where;
      expect(whereArg.status).toEqual({ not: ProjectStatus.ARCHIVED });
    });

    it('filters by explicit status', async () => {
      await service.listProjects(q({ status: ProjectStatus.ONGOING as never }), superAdmin);
      const whereArg = mockPrisma.project.findMany.mock.calls[0][0].where;
      expect(whereArg.status).toBe('ONGOING');
    });

    it('applies search filter', async () => {
      await service.listProjects(q({ search: 'bridge' }), superAdmin);
      const whereArg = mockPrisma.project.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toEqual([
        { name: { contains: 'bridge', mode: 'insensitive' } },
        { description: { contains: 'bridge', mode: 'insensitive' } },
      ]);
    });

    it('returns mapped items with meta', async () => {
      mockPrisma.project.findMany.mockResolvedValue([
        {
          id: 'p-1',
          name: 'Test',
          description: 'Desc',
          status: 'PLANNED',
          type: 'Construction',
          locations: [
            { type: 'DELIVERY', address: '123 Main', isDefault: true },
            { type: 'STORAGE', address: '456 Ware', isDefault: true },
          ],
          _count: { members: 3 },
          startDate: new Date('2026-01-01'),
          expectedEndDate: new Date('2026-12-31'),
          createdAt: new Date('2025-12-01'),
        },
      ]);
      mockPrisma.project.count.mockResolvedValue(1);

      const result = await service.listProjects(q({ page: 1, limit: 25 }), superAdmin);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].defaultDeliveryLocation).toBe('123 Main');
      expect(result.items[0].defaultStorageLocation).toBe('456 Ware');
      expect(result.items[0].memberCount).toBe(3);
      expect(result.meta).toEqual({ page: 1, limit: 25, total: 1, totalPages: 1 });
    });

    it('caps limit at 100', async () => {
      await service.listProjects(q({ limit: 200 }), superAdmin);
      const call = mockPrisma.project.findMany.mock.calls[0][0];
      expect(call.take).toBe(100);
    });

    it('handles items with null dates and no default locations', async () => {
      mockPrisma.project.findMany.mockResolvedValue([
        {
          id: 'p-2',
          name: 'Empty',
          description: null,
          status: 'PLANNED',
          type: null,
          locations: [],
          _count: { members: 1 },
          startDate: null,
          expectedEndDate: null,
          createdAt: new Date('2026-01-01'),
        },
      ]);
      mockPrisma.project.count.mockResolvedValue(1);

      const result = await service.listProjects(q(), superAdmin);
      expect(result.items[0].defaultDeliveryLocation).toBe('');
      expect(result.items[0].defaultStorageLocation).toBe('');
      expect(result.items[0].startDate).toBeNull();
      expect(result.items[0].expectedEndDate).toBeNull();
    });

    it('sorts by name', async () => {
      await service.listProjects(
        q({ sortBy: 'name' as never, sortDir: 'asc' as never }),
        superAdmin,
      );
      const orderBy = mockPrisma.project.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.name).toBe('asc');
    });

    it('sorts by status', async () => {
      await service.listProjects(
        q({ sortBy: 'status' as never, sortDir: 'desc' as never }),
        superAdmin,
      );
      const orderBy = mockPrisma.project.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.status).toBe('desc');
    });

    it('sorts by startDate', async () => {
      await service.listProjects(
        q({ sortBy: 'startDate' as never, sortDir: 'asc' as never }),
        superAdmin,
      );
      const orderBy = mockPrisma.project.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.startDate).toBe('asc');
    });

    it('defaults to createdAt sort when unknown sortBy', async () => {
      await service.listProjects(q({ sortBy: 'unknown' as never }), superAdmin);
      const orderBy = mockPrisma.project.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.createdAt).toBeDefined();
    });
  });

  // ── createProject ──────────────────────────────────────────────────────

  describe('createProject', () => {
    const dto = {
      name: 'New Project',
      locations: validLocations,
      assignedUserIds: ['po-1'],
      startDate: '2026-01-01',
      expectedEndDate: '2026-12-31',
    };

    beforeEach(() => {
      mockPrisma.project.findUnique.mockResolvedValue(null); // no duplicate
      mockTx.project.create.mockResolvedValue({ id: 'p-new' });
      // Mock getProject after create
      mockPrisma.project.findUnique
        .mockResolvedValueOnce(null) // duplicate check
        .mockResolvedValueOnce({
          id: 'p-new',
          name: 'New Project',
          description: null,
          status: 'PLANNED',
          type: null,
          locations: [],
          members: [],
          pointOfContact: null,
          createdBy: { id: 'ca-1', name: 'Admin' },
          plannedBudget: null,
          currency: 'AUD',
          startDate: null,
          expectedEndDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
    });

    it('creates a project successfully via transaction', async () => {
      const result = await service.createProject(dto, companyAdmin);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockTx.project.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe('p-new');
    });

    it('throws ConflictException on duplicate name', async () => {
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.createProject(dto, companyAdmin)).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when end date is before start date', async () => {
      await expect(
        service.createProject(
          { ...dto, startDate: '2026-12-31', expectedEndDate: '2026-01-01' },
          companyAdmin,
        ),
      ).rejects.toThrow('Expected end date must be after start date');
    });

    it('ProcurementOfficer can only assign themselves', async () => {
      // PO self-assigns only ['po-1'], so validateCompanyUsers expects 1 user back
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'po-1' }]);
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique
        .mockResolvedValueOnce(null) // dup check
        .mockResolvedValueOnce({
          id: 'p-new',
          name: 'New',
          description: null,
          status: 'PLANNED',
          type: null,
          locations: [],
          members: [],
          pointOfContact: null,
          createdBy: { id: 'po-1', name: 'PO' },
          plannedBudget: null,
          currency: 'AUD',
          startDate: null,
          expectedEndDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      mockTx.project.create.mockResolvedValue({ id: 'p-new' });

      await service.createProject({ ...dto, assignedUserIds: ['po-1', 'other-user'] }, procOfficer);

      // The create call's members should only contain the PO's own ID
      const createCall = mockTx.project.create.mock.calls[0][0];
      const memberIds = createCall.data.members.create.map((m: { userId: string }) => m.userId);
      expect(memberIds).toEqual(['po-1']);
    });

    it('validates locations — no delivery', async () => {
      const badLocations = [{ type: 'STORAGE' as const, address: 'Addr', isDefault: true }];
      await expect(
        service.createProject({ ...dto, locations: badLocations }, companyAdmin),
      ).rejects.toThrow('At least one delivery location is required');
    });

    it('validates locations — no storage', async () => {
      const badLocations = [{ type: 'DELIVERY' as const, address: 'Addr', isDefault: true }];
      await expect(
        service.createProject({ ...dto, locations: badLocations }, companyAdmin),
      ).rejects.toThrow('At least one storage location is required');
    });

    it('validates locations — no default delivery', async () => {
      const badLocations = [
        { type: 'DELIVERY' as const, address: 'Addr', isDefault: false },
        { type: 'STORAGE' as const, address: 'Addr', isDefault: true },
      ];
      await expect(
        service.createProject({ ...dto, locations: badLocations }, companyAdmin),
      ).rejects.toThrow('At least one default delivery location is required');
    });

    it('validates locations — no default storage', async () => {
      const badLocations = [
        { type: 'DELIVERY' as const, address: 'Addr', isDefault: true },
        { type: 'STORAGE' as const, address: 'Addr', isDefault: false },
      ];
      await expect(
        service.createProject({ ...dto, locations: badLocations }, companyAdmin),
      ).rejects.toThrow('At least one default storage location is required');
    });

    it('validates locations — multiple default deliveries', async () => {
      const badLocations = [
        { type: 'DELIVERY' as const, address: 'Addr1', isDefault: true },
        { type: 'DELIVERY' as const, address: 'Addr2', isDefault: true },
        { type: 'STORAGE' as const, address: 'Addr', isDefault: true },
      ];
      await expect(
        service.createProject({ ...dto, locations: badLocations }, companyAdmin),
      ).rejects.toThrow('Only one default delivery location is allowed');
    });

    it('validates locations — multiple default storages', async () => {
      const badLocations = [
        { type: 'DELIVERY' as const, address: 'Addr', isDefault: true },
        { type: 'STORAGE' as const, address: 'Addr1', isDefault: true },
        { type: 'STORAGE' as const, address: 'Addr2', isDefault: true },
      ];
      await expect(
        service.createProject({ ...dto, locations: badLocations }, companyAdmin),
      ).rejects.toThrow('Only one default storage location is allowed');
    });

    it('throws when assigned users are not valid', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]); // none found
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.createProject(dto, companyAdmin)).rejects.toThrow(
        'Users not found or not active',
      );
    });

    it('validates pointOfContactId when provided', async () => {
      // First findMany call validates assignedUserIds (po-1 + ca-1), second validates pointOfContactId
      mockPrisma.user.findMany
        .mockResolvedValueOnce([{ id: 'po-1' }, { id: 'ca-1' }]) // assigned users valid
        .mockResolvedValueOnce([{ id: 'poc-1' }]); // PoC valid
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique
        .mockResolvedValueOnce(null) // dup check
        .mockResolvedValueOnce({
          id: 'p-new',
          name: 'New Project',
          description: null,
          status: 'PLANNED',
          type: null,
          locations: [],
          members: [],
          pointOfContact: { id: 'poc-1', name: 'Contact' },
          createdBy: { id: 'ca-1', name: 'Admin' },
          plannedBudget: null,
          currency: 'AUD',
          startDate: null,
          expectedEndDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      mockTx.project.create.mockResolvedValue({ id: 'p-new' });

      const result = await service.createProject(
        { ...dto, pointOfContactId: 'poc-1' },
        companyAdmin,
      );
      expect(result.id).toBe('p-new');
      expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(2);
    });

    it('throws when pointOfContactId is invalid', async () => {
      mockPrisma.user.findMany
        .mockResolvedValueOnce([{ id: 'po-1' }, { id: 'ca-1' }]) // assigned users valid
        .mockResolvedValueOnce([]); // PoC not found
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique.mockResolvedValueOnce(null); // dup check

      await expect(
        service.createProject({ ...dto, pointOfContactId: 'bad-poc' }, companyAdmin),
      ).rejects.toThrow('Users not found or not active');
    });

    it('creates project without optional fields (no dates, no budget)', async () => {
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique
        .mockResolvedValueOnce(null) // dup check
        .mockResolvedValueOnce({
          id: 'p-new',
          name: 'Minimal',
          description: null,
          status: 'PLANNED',
          type: null,
          locations: [],
          members: [],
          pointOfContact: null,
          createdBy: { id: 'ca-1', name: 'Admin' },
          plannedBudget: null,
          currency: 'AUD',
          startDate: null,
          expectedEndDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      mockTx.project.create.mockResolvedValue({ id: 'p-new' });

      const minimalDto = {
        name: 'Minimal',
        locations: validLocations,
        assignedUserIds: ['po-1'],
      };
      const result = await service.createProject(minimalDto, companyAdmin);
      expect(result.id).toBe('p-new');
      // Verify create was called without dates/budget
      const createData = mockTx.project.create.mock.calls[0][0].data;
      expect(createData.startDate).toBeNull();
      expect(createData.expectedEndDate).toBeNull();
      expect(createData.plannedBudget).toBeNull();
    });

    it('creates project with plannedBudget', async () => {
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique
        .mockResolvedValueOnce(null) // dup check
        .mockResolvedValueOnce({
          id: 'p-new',
          name: 'Budget Project',
          description: null,
          status: 'PLANNED',
          type: null,
          locations: [],
          members: [],
          pointOfContact: null,
          createdBy: { id: 'ca-1', name: 'Admin' },
          plannedBudget: 100000,
          currency: 'AUD',
          startDate: null,
          expectedEndDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      mockTx.project.create.mockResolvedValue({ id: 'p-new' });

      const budgetDto = {
        name: 'Budget Project',
        locations: validLocations,
        assignedUserIds: ['po-1'],
        plannedBudget: 100000,
      };
      const result = await service.createProject(budgetDto, companyAdmin);
      expect(result.id).toBe('p-new');
    });
  });

  // ── getProject ─────────────────────────────────────────────────────────

  describe('getProject', () => {
    it('returns formatted project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'p-1',
        name: 'Test',
        description: 'Desc',
        status: 'PLANNED',
        type: 'Construction',
        locations: [
          { id: 'loc-1', type: 'DELIVERY', address: 'Addr', label: null, isDefault: true },
        ],
        members: [
          {
            user: { id: 'u-1', name: 'User', email: 'u@t.com', role: 'PROCUREMENT_OFFICER' },
            assignedBy: { id: 'ca-1', name: 'Admin' },
            assignedAt: new Date('2026-01-01'),
          },
        ],
        pointOfContact: { id: 'u-1', name: 'User' },
        createdBy: { id: 'ca-1', name: 'Admin' },
        plannedBudget: 50000,
        currency: 'AUD',
        startDate: new Date('2026-01-01'),
        expectedEndDate: new Date('2026-12-31'),
        createdAt: new Date('2025-12-01'),
        updatedAt: new Date('2025-12-02'),
      });

      const result = await service.getProject('p-1');
      expect(result.id).toBe('p-1');
      expect(result.assignedUsers).toHaveLength(1);
      expect(result.plannedBudget).toBe(50000);
      expect(result.activeBom).toBeNull();
      expect(result.rfqCount).toBe(0);
    });

    it('throws NotFoundException when project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);
      await expect(service.getProject('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateProject ──────────────────────────────────────────────────────

  describe('updateProject', () => {
    const existingProject = {
      companyId: 'comp-1',
      status: ProjectStatus.PLANNED,
      name: 'Original',
    };

    const getProjectMock = {
      id: 'p-1',
      name: 'Updated',
      description: null,
      status: 'PLANNED',
      type: null,
      locations: [],
      members: [],
      pointOfContact: null,
      createdBy: { id: 'ca-1', name: 'Admin' },
      plannedBudget: null,
      currency: 'AUD',
      startDate: null,
      expectedEndDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockPrisma.project.findUnique.mockReset();
      // First call: existing project check in updateProject
      // Second call: name duplicate check (null = no duplicate)
      // Third call: getProject after update
      mockPrisma.project.findUnique
        .mockResolvedValueOnce(existingProject)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(getProjectMock);
      mockTx.project.update.mockResolvedValue({});
    });

    it('updates project successfully', async () => {
      // beforeEach already sets: existingProject -> null (dup check) -> getProjectMock
      const result = await service.updateProject('p-1', { name: 'Updated' }, companyAdmin);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when project not found', async () => {
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique.mockResolvedValue(null);
      await expect(service.updateProject('bad-id', { name: 'X' }, companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws on invalid status transition', async () => {
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique.mockResolvedValue({
        ...existingProject,
        status: ProjectStatus.COMPLETED,
      });

      await expect(
        service.updateProject('p-1', { status: 'ONGOING' }, companyAdmin),
      ).rejects.toThrow('Invalid status transition');
    });

    it('allows valid status transition (Planned -> Ongoing)', async () => {
      // No name change, so no duplicate check needed. Re-setup mocks:
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique
        .mockResolvedValueOnce(existingProject)
        .mockResolvedValueOnce(getProjectMock); // getProject after update
      await expect(
        service.updateProject('p-1', { status: 'ONGOING' }, companyAdmin),
      ).resolves.toBeDefined();
    });

    it('throws ConflictException on duplicate name', async () => {
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique
        .mockResolvedValueOnce(existingProject) // existing
        .mockResolvedValueOnce({ id: 'p-other' }); // duplicate found

      await expect(
        service.updateProject('p-1', { name: 'Duplicate' }, companyAdmin),
      ).rejects.toThrow(ConflictException);
    });

    it('ProcurementOfficer cannot change assigned users', async () => {
      // No name change — only needs existingProject + getProjectMock
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique.mockResolvedValueOnce(existingProject);
      await expect(
        service.updateProject('p-1', { assignedUserIds: ['u-2'] }, procOfficer),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ProcurementOfficer cannot archive projects', async () => {
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique.mockResolvedValueOnce(existingProject);
      await expect(
        service.updateProject('p-1', { status: ProjectStatus.ARCHIVED }, procOfficer),
      ).rejects.toThrow(ForbiddenException);
    });

    it('validates locations when provided in update', async () => {
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique.mockResolvedValueOnce(existingProject);
      const badLocations = [{ type: 'DELIVERY' as const, address: 'Addr', isDefault: true }];
      await expect(
        service.updateProject('p-1', { locations: badLocations }, companyAdmin),
      ).rejects.toThrow('At least one storage location is required');
    });

    it('throws when end date is before start date', async () => {
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique.mockResolvedValueOnce(existingProject);
      await expect(
        service.updateProject(
          'p-1',
          { startDate: '2026-12-31', expectedEndDate: '2026-01-01' },
          companyAdmin,
        ),
      ).rejects.toThrow('Expected end date must be after start date');
    });

    it('replaces locations in transaction when provided', async () => {
      mockPrisma.project.findUnique.mockReset();
      // No name change: existingProject -> getProjectMock
      mockPrisma.project.findUnique.mockResolvedValueOnce(existingProject).mockResolvedValueOnce({
        id: 'p-1',
        name: 'Original',
        description: null,
        status: 'PLANNED',
        type: null,
        locations: validLocations,
        members: [],
        pointOfContact: null,
        createdBy: { id: 'ca-1', name: 'Admin' },
        plannedBudget: null,
        currency: 'AUD',
        startDate: null,
        expectedEndDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.updateProject('p-1', { locations: validLocations }, companyAdmin);

      expect(mockTx.projectLocation.deleteMany).toHaveBeenCalledWith({
        where: { projectId: 'p-1' },
      });
      expect(mockTx.projectLocation.createMany).toHaveBeenCalled();
    });

    it('covers all updateData branches (budget, dates, pointOfContact, assignedUsers)', async () => {
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique
        .mockResolvedValueOnce(existingProject)
        .mockResolvedValueOnce(getProjectMock);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'u-2' }]);

      await service.updateProject(
        'p-1',
        {
          description: 'New desc',
          type: 'Construction',
          plannedBudget: 100000,
          currency: 'USD',
          startDate: '2026-01-01',
          expectedEndDate: '2026-12-31',
          pointOfContactId: 'u-2',
          assignedUserIds: ['u-2'],
        },
        companyAdmin,
      );
      expect(mockTx.project.update).toHaveBeenCalled();
    });

    it('handles null pointOfContactId (disconnect)', async () => {
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique
        .mockResolvedValueOnce(existingProject)
        .mockResolvedValueOnce(getProjectMock);

      await service.updateProject(
        'p-1',
        {
          pointOfContactId: '',
          plannedBudget: undefined,
          startDate: '',
          expectedEndDate: '',
        },
        companyAdmin,
      );
      expect(mockTx.project.update).toHaveBeenCalled();
    });
  });

  // ── addMembers ─────────────────────────────────────────────────────────

  describe('addMembers', () => {
    beforeEach(() => {
      mockPrisma.project.findUnique.mockResolvedValue({ companyId: 'comp-1' });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'u-new' }]);
      mockPrisma.projectMember.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.projectMember.findMany
        .mockResolvedValueOnce([]) // existing members check
        .mockResolvedValueOnce([
          {
            user: { id: 'u-new', name: 'New', email: 'n@t.com', role: 'PROCUREMENT_OFFICER' },
            assignedBy: { id: 'ca-1', name: 'Admin' },
            assignedAt: new Date(),
          },
        ]); // getProjectMembers
    });

    it('adds new members and skips existing', async () => {
      const result = await service.addMembers('p-1', ['u-new'], companyAdmin);
      expect(mockPrisma.projectMember.createMany).toHaveBeenCalled();
      expect(result.members).toHaveLength(1);
    });

    it('throws NotFoundException when project not found', async () => {
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique.mockResolvedValue(null);
      await expect(service.addMembers('bad-id', ['u-1'], companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('skips already existing members', async () => {
      mockPrisma.projectMember.findMany.mockReset();
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'u-existing' }]);
      mockPrisma.projectMember.findMany
        .mockResolvedValueOnce([{ userId: 'u-existing' }]) // existing members
        .mockResolvedValueOnce([]); // getProjectMembers

      await service.addMembers('p-1', ['u-existing'], companyAdmin);
      expect(mockPrisma.projectMember.createMany).not.toHaveBeenCalled();
    });
  });

  // ── removeMember ───────────────────────────────────────────────────────

  describe('removeMember', () => {
    const membersFindManyResult = [
      {
        user: { id: 'u-2', name: 'Remaining', email: 'r@t.com', role: 'PROCUREMENT_OFFICER' },
        assignedBy: { id: 'ca-1', name: 'Admin' },
        assignedAt: new Date(),
      },
    ];

    beforeEach(() => {
      mockPrisma.project.findUnique.mockResolvedValue({ createdByUserId: 'ca-1' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ userId: 'u-1' });
      mockPrisma.projectMember.count.mockResolvedValue(3);
      mockPrisma.projectMember.delete.mockResolvedValue({});
      mockPrisma.projectMember.findMany.mockResolvedValue(membersFindManyResult);
    });

    it('removes a member successfully', async () => {
      const result = await service.removeMember('p-1', 'u-1', companyAdmin);
      expect(mockPrisma.projectMember.delete).toHaveBeenCalledWith({
        where: { projectId_userId: { projectId: 'p-1', userId: 'u-1' } },
      });
      expect(result.members).toHaveLength(1);
    });

    it('throws NotFoundException when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);
      await expect(service.removeMember('bad-id', 'u-1', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when user is not a member', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);
      await expect(service.removeMember('p-1', 'u-1', companyAdmin)).rejects.toThrow(
        'User is not a member of this project',
      );
    });

    it('throws when removing last member', async () => {
      mockPrisma.projectMember.count.mockResolvedValue(1);
      await expect(service.removeMember('p-1', 'u-1', companyAdmin)).rejects.toThrow(
        'Cannot remove the last member',
      );
    });

    it('throws when removing auto-assigned PO creator', async () => {
      // user being removed is the creator
      mockPrisma.project.findUnique.mockResolvedValue({ createdByUserId: 'po-1' });
      mockPrisma.user.findUnique.mockResolvedValue({ role: UserRole.PROCUREMENT_OFFICER });

      await expect(service.removeMember('p-1', 'po-1', companyAdmin)).rejects.toThrow(
        'Cannot remove the project creator',
      );
    });

    it('allows removing creator if creator is not ProcurementOfficer', async () => {
      mockPrisma.project.findUnique.mockReset();
      mockPrisma.project.findUnique.mockResolvedValue({ createdByUserId: 'ca-1' });
      mockPrisma.user.findUnique.mockResolvedValue({ role: UserRole.COMPANY_ADMIN });

      const result = await service.removeMember('p-1', 'ca-1', companyAdmin);
      expect(result.members).toHaveLength(1);
    });
  });
});
