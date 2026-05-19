import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { CompaniesService, CreateCompanyDto, CompanyListQueryDto } from './companies.service';

const CompanyType = { CONTRACTOR: 'CONTRACTOR', VENDOR: 'VENDOR' } as const;
const UserRole = { SUPER_ADMIN: 'SUPER_ADMIN', COMPANY_ADMIN: 'COMPANY_ADMIN' } as const;

describe('CompaniesService', () => {
  let service: CompaniesService;
  let prisma: {
    company: {
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    companyVendorAssignment: {
      findMany: jest.Mock;
      create: jest.Mock;
      createMany: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  const superAdmin = { id: 'u1', role: UserRole.SUPER_ADMIN, companyId: null };
  const companyAdmin = { id: 'u2', role: UserRole.COMPANY_ADMIN, companyId: 'c1' };

  beforeEach(() => {
    prisma = {
      company: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      companyVendorAssignment: {
        findMany: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    service = new CompaniesService(prisma as never);
  });

  describe('listCompanies', () => {
    it('should return paginated results for SuperAdmin', async () => {
      const items = [{ id: 'c1', legalName: 'Acme' }];
      prisma.company.findMany.mockResolvedValue(items);
      prisma.company.count.mockResolvedValue(1);

      const result = await service.listCompanies({}, superAdmin);

      expect(result.items).toEqual(items);
      expect(result.meta).toEqual({ page: 1, limit: 25, total: 1, totalPages: 1 });
    });

    it('should scope CompanyAdmin to their own company', async () => {
      prisma.company.findMany.mockResolvedValue([]);
      prisma.company.count.mockResolvedValue(0);

      await service.listCompanies({}, companyAdmin);

      const where = prisma.company.findMany.mock.calls[0][0].where;
      expect(where.id).toBe('c1');
    });

    it('should filter by search text', async () => {
      prisma.company.findMany.mockResolvedValue([]);
      prisma.company.count.mockResolvedValue(0);

      await service.listCompanies({ search: 'acme' }, superAdmin);

      const where = prisma.company.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { legalName: { contains: 'acme', mode: 'insensitive' } },
        { tradeName: { contains: 'acme', mode: 'insensitive' } },
      ]);
    });

    it('should filter by type', async () => {
      prisma.company.findMany.mockResolvedValue([]);
      prisma.company.count.mockResolvedValue(0);

      await service.listCompanies({ type: CompanyType.CONTRACTOR as never }, superAdmin);

      const where = prisma.company.findMany.mock.calls[0][0].where;
      expect(where.type).toBe(CompanyType.CONTRACTOR);
    });

    it('should filter by status', async () => {
      prisma.company.findMany.mockResolvedValue([]);
      prisma.company.count.mockResolvedValue(0);

      await service.listCompanies({ status: 'ACTIVE' as never }, superAdmin);

      const where = prisma.company.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('ACTIVE');
    });

    it('should cap limit at 100', async () => {
      prisma.company.findMany.mockResolvedValue([]);
      prisma.company.count.mockResolvedValue(0);

      await service.listCompanies({ limit: 500 }, superAdmin);

      expect(prisma.company.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    });
  });

  describe('createCompany', () => {
    it('should create a contractor company', async () => {
      const dto: CreateCompanyDto = { type: CompanyType.CONTRACTOR as never, legalName: 'Acme' };
      const created = { id: 'c1', ...dto };
      prisma.company.create.mockResolvedValue(created);

      const result = await service.createCompany(dto);

      expect(prisma.company.create).toHaveBeenCalledWith({
        data: { type: CompanyType.CONTRACTOR, legalName: 'Acme' },
      });
      expect(result).toEqual(created);
    });

    it('should throw BadRequestException for Vendor without contactEmail', async () => {
      const dto: CreateCompanyDto = { type: CompanyType.VENDOR as never, legalName: 'Vendor Co' };

      await expect(service.createCompany(dto)).rejects.toThrow(BadRequestException);
    });

    it('should create vendor and assign to contractors', async () => {
      const dto: CreateCompanyDto = {
        type: CompanyType.VENDOR as never,
        legalName: 'Vendor Co',
        contactEmail: 'v@test.com',
        assignedContractorIds: ['c1', 'c2'],
      };
      const created = { id: 'v1', type: CompanyType.VENDOR, legalName: 'Vendor Co' };
      prisma.company.create.mockResolvedValue(created);
      prisma.companyVendorAssignment.createMany.mockResolvedValue({ count: 2 });

      const result = await service.createCompany(dto);

      expect(prisma.company.create).toHaveBeenCalled();
      expect(prisma.companyVendorAssignment.createMany).toHaveBeenCalledWith({
        data: [
          { vendorId: 'v1', contractorId: 'c1' },
          { vendorId: 'v1', contractorId: 'c2' },
        ],
      });
      expect(result).toEqual(created);
    });

    it('should not create assignments for vendor without assignedContractorIds', async () => {
      const dto: CreateCompanyDto = {
        type: CompanyType.VENDOR as never,
        legalName: 'Vendor Co',
        contactEmail: 'v@test.com',
      };
      prisma.company.create.mockResolvedValue({ id: 'v1' });

      await service.createCompany(dto);

      expect(prisma.companyVendorAssignment.createMany).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when non-SUPER_ADMIN creates non-VENDOR type', async () => {
      const dto: CreateCompanyDto = {
        type: CompanyType.CONTRACTOR as never,
        legalName: 'Contractor Co',
      };

      await expect(service.createCompany(dto, companyAdmin)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when non-SUPER_ADMIN user has no companyId', async () => {
      const userWithoutCompany = { id: 'u3', role: UserRole.COMPANY_ADMIN, companyId: null };
      const dto: CreateCompanyDto = {
        type: CompanyType.VENDOR as never,
        legalName: 'Vendor Co',
        contactEmail: 'v@test.com',
      };

      await expect(service.createCompany(dto, userWithoutCompany)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should auto-assign vendor to requesting contractor when non-SUPER_ADMIN creates vendor', async () => {
      const dto: CreateCompanyDto = {
        type: CompanyType.VENDOR as never,
        legalName: 'Vendor Co',
        contactEmail: 'v@test.com',
      };
      const created = { id: 'v1', type: CompanyType.VENDOR, legalName: 'Vendor Co' };
      prisma.company.create.mockResolvedValue(created);
      prisma.companyVendorAssignment.createMany.mockResolvedValue({ count: 0 });

      await service.createCompany(dto, companyAdmin);

      expect(prisma.companyVendorAssignment.create).toHaveBeenCalledWith({
        data: { vendorId: 'v1', contractorId: 'c1' },
      });
    });
  });

  describe('getCompany', () => {
    it('should return company for SuperAdmin', async () => {
      const company = { id: 'c1', legalName: 'Acme', _count: { users: 3 } };
      prisma.company.findUnique.mockResolvedValue(company);

      const result = await service.getCompany('c1', superAdmin);

      expect(result).toEqual(company);
    });

    it('should throw NotFoundException when company does not exist', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.getCompany('nonexistent', superAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for CompanyAdmin accessing another company', async () => {
      const company = { id: 'c2', legalName: 'Other Co', _count: { users: 1 } };
      prisma.company.findUnique.mockResolvedValue(company);

      await expect(service.getCompany('c2', companyAdmin)).rejects.toThrow(ForbiddenException);
    });

    it('should allow CompanyAdmin to access their own company', async () => {
      const company = { id: 'c1', legalName: 'Acme', _count: { users: 3 } };
      prisma.company.findUnique.mockResolvedValue(company);

      const result = await service.getCompany('c1', companyAdmin);

      expect(result).toEqual(company);
    });
  });

  describe('updateCompany', () => {
    it('should update company after access check', async () => {
      const company = { id: 'c1', legalName: 'Acme', _count: { users: 3 } };
      prisma.company.findUnique.mockResolvedValue(company);
      prisma.company.update.mockResolvedValue({ ...company, legalName: 'Acme Updated' });

      const result = await service.updateCompany('c1', { legalName: 'Acme Updated' }, superAdmin);

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { legalName: 'Acme Updated' },
      });
      expect(result.legalName).toBe('Acme Updated');
    });
  });

  describe('getCompanyVendors', () => {
    it('should return vendors with assignedAt', async () => {
      const assignedAt = new Date();
      prisma.companyVendorAssignment.findMany.mockResolvedValue([
        {
          vendor: { id: 'v1', legalName: 'Vendor', _count: { users: 2 } },
          assignedAt,
        },
      ]);

      const result = await service.getCompanyVendors('c1');

      expect(result).toEqual([{ id: 'v1', legalName: 'Vendor', _count: { users: 2 }, assignedAt }]);
    });
  });

  describe('assignVendorsToContractor', () => {
    it('should assign vendors to a contractor', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1', type: CompanyType.CONTRACTOR });
      prisma.company.findMany.mockResolvedValue([
        { id: 'v1', type: CompanyType.VENDOR },
        { id: 'v2', type: CompanyType.VENDOR },
      ]);
      prisma.companyVendorAssignment.createMany.mockResolvedValue({ count: 2 });
      prisma.companyVendorAssignment.findMany.mockResolvedValue([]);

      await service.assignVendorsToContractor('c1', { contractorIds: ['v1', 'v2'] });

      expect(prisma.companyVendorAssignment.createMany).toHaveBeenCalledWith({
        data: [
          { vendorId: 'v1', contractorId: 'c1' },
          { vendorId: 'v2', contractorId: 'c1' },
        ],
        skipDuplicates: true,
      });
    });

    it('should throw NotFoundException when contractor does not exist', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.assignVendorsToContractor('nonexistent', { contractorIds: ['v1'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when company is not a Contractor', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'v1', type: CompanyType.VENDOR });

      await expect(
        service.assignVendorsToContractor('v1', { contractorIds: ['v2'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when some vendor IDs are invalid', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1', type: CompanyType.CONTRACTOR });
      prisma.company.findMany.mockResolvedValue([{ id: 'v1', type: CompanyType.VENDOR }]);

      await expect(
        service.assignVendorsToContractor('c1', { contractorIds: ['v1', 'invalid-id'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when non-SUPER_ADMIN assigns to different company', async () => {
      await expect(
        service.assignVendorsToContractor('other-company', { contractorIds: ['v1'] }, companyAdmin),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('removeVendorFromContractor', () => {
    it('should remove vendor assignment', async () => {
      prisma.companyVendorAssignment.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.removeVendorFromContractor('c1', 'v1');

      expect(prisma.companyVendorAssignment.deleteMany).toHaveBeenCalledWith({
        where: { contractorId: 'c1', vendorId: 'v1' },
      });
      expect(result).toEqual({ message: 'Vendor unassigned successfully' });
    });

    it('should throw NotFoundException when assignment does not exist', async () => {
      prisma.companyVendorAssignment.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.removeVendorFromContractor('c1', 'v-nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

describe('CompanyListQueryDto @Transform decorators', () => {
  it('should parse page string to number via @Transform', () => {
    const dto = plainToInstance(CompanyListQueryDto, { page: '3' });
    expect(dto.page).toBe(3);
  });

  it('should parse limit string to number via @Transform', () => {
    const dto = plainToInstance(CompanyListQueryDto, { limit: '50' });
    expect(dto.limit).toBe(50);
  });

  it('should use default page=1 when not provided', () => {
    const dto = plainToInstance(CompanyListQueryDto, {});
    expect(dto.page).toBe(1);
  });

  it('should use default limit=25 when not provided', () => {
    const dto = plainToInstance(CompanyListQueryDto, {});
    expect(dto.limit).toBe(25);
  });
});
