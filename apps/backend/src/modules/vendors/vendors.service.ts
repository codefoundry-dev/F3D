import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CompanyType, UserRole, UserStatus } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

import {
  AuthUser,
  CreateWarehouseDto,
  UpdateVendorProfileDto,
  UpdateWarehouseDto,
  VendorListQueryDto,
} from './vendors.dto';

// Re-export DTOs and AuthUser for backward compatibility with existing tests
export { InviteVendorDto, VendorListQueryDto, AuthUser } from './vendors.dto';

export interface VendorRepresentativeRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  status: 'ACTIVE' | 'INVITED';
  createdAt: string;
}

export interface VendorListRow {
  id: string;
  userId: string | null;
  companyId: string;
  companyName: string;
  companyEmail: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: 'ACTIVE' | 'INVITED';
  assignedAt: string;
  specialisations: string[];
  categories: string[];
  representatives: VendorRepresentativeRow[];
}

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async listVendors(query: VendorListQueryDto, requestingUser: AuthUser) {
    if (!requestingUser.companyId) {
      return { items: [], meta: { page: 1, limit: 25, total: 0, totalPages: 0 } };
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 25, 100);
    const skip = (page - 1) * limit;

    // Build where clause for assignments
    const assignmentWhere: Record<string, unknown> = {
      contractorId: requestingUser.companyId,
    };

    // Build vendor sub-filter
    const vendorWhere: Record<string, unknown> = {};

    if (query.search) {
      vendorWhere['OR'] = [
        { legalName: { contains: query.search, mode: 'insensitive' } },
        { contactEmail: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.specialisation) {
      const specs = query.specialisation.split(',').map((s) => s.trim());
      vendorWhere['specialisations'] = { hasSome: specs };
    }

    if (Object.keys(vendorWhere).length > 0) {
      assignmentWhere['vendor'] = vendorWhere;
    }

    if (query.dateFrom || query.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (query.dateFrom) dateFilter['gte'] = new Date(query.dateFrom);
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        to.setHours(23, 59, 59, 999);
        dateFilter['lte'] = to;
      }
      assignmentWhere['assignedAt'] = dateFilter;
    }

    const assignments = await this.prisma.companyVendorAssignment.findMany({
      where: assignmentWhere,
      orderBy: { assignedAt: query.sortDir ?? 'desc' },
      include: {
        vendor: {
          include: {
            users: {
              where: { role: UserRole.VENDOR },
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                position: true,
                status: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    // One row per vendor company with all representatives
    const allItems: VendorListRow[] = assignments.map((a) => {
      const primaryUser = a.vendor.users[0];
      // Company status: ACTIVE if any user is active, otherwise INVITED
      const hasActiveUser = a.vendor.users.some((u) => u.status === UserStatus.ACTIVE);
      const status = hasActiveUser ? 'ACTIVE' : 'INVITED';

      const representatives: VendorRepresentativeRow[] = a.vendor.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone ?? null,
        position: u.position ?? null,
        status: u.status === UserStatus.ACTIVE ? 'ACTIVE' : 'INVITED',
        createdAt: u.createdAt.toISOString(),
      }));

      return {
        id: a.id,
        userId: primaryUser?.id ?? null,
        companyId: a.vendor.id,
        companyName: a.vendor.legalName,
        companyEmail: a.vendor.contactEmail,
        contactName: primaryUser?.name ?? null,
        contactEmail: primaryUser?.email ?? null,
        contactPhone: primaryUser?.phone ?? null,
        status,
        assignedAt: a.assignedAt.toISOString(),
        specialisations: a.vendor.specialisations,
        categories: a.categories,
        representatives,
      };
    });

    // Filter by status if requested
    const filteredItems = query.status
      ? allItems.filter((item) => item.status === query.status)
      : allItems;

    const total = filteredItems.length;
    const paginatedItems = filteredItems.slice(skip, skip + limit);

    return {
      items: paginatedItems,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ── Vendor Profile ────────────────────────────────────────────────────────

  /**
   * Validates that a user has access to a vendor company.
   * - Vendor users can access their own company.
   * - Contractor users can access vendors assigned to their company.
   */
  private async validateVendorAccess(
    vendorCompanyId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    // Vendor accessing own company
    if (user.role === UserRole.VENDOR) {
      if (user.companyId !== vendorCompanyId) {
        throw new ForbiddenException(ERR.vendors.accessDenied);
      }
      return;
    }

    // Contractor roles: check vendor is in their assignment list
    if (!user.companyId) {
      throw new ForbiddenException(ERR.vendors.accessDenied);
    }

    const assignment = await this.prisma.companyVendorAssignment.findFirst({
      where: {
        vendorId: vendorCompanyId,
        contractorId: user.companyId,
      },
    });

    if (!assignment) {
      throw new ForbiddenException(ERR.vendors.accessDenied);
    }
  }

  async getVendorProfile(vendorCompanyId: string, user: AuthenticatedUser) {
    const company = await this.prisma.company.findFirst({
      where: { id: vendorCompanyId, type: CompanyType.VENDOR },
      include: {
        users: {
          where: { role: UserRole.VENDOR },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            position: true,
            department: true,
            status: true,
          },
        },
        warehouseLocations: true,
        documents: {
          include: { file: true },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(ERR.vendors.notFound);
    }

    await this.validateVendorAccess(vendorCompanyId, user);

    return company;
  }

  async updateVendorProfile(
    vendorCompanyId: string,
    dto: UpdateVendorProfileDto,
    user: AuthenticatedUser,
  ) {
    const company = await this.prisma.company.findFirst({
      where: { id: vendorCompanyId, type: CompanyType.VENDOR },
    });

    if (!company) {
      throw new NotFoundException(ERR.vendors.notFound);
    }

    await this.validateVendorAccess(vendorCompanyId, user);

    const updated = await this.prisma.company.update({
      where: { id: vendorCompanyId },
      data: {
        ...(dto.legalName !== undefined && { legalName: dto.legalName }),
        ...(dto.tradeName !== undefined && { tradeName: dto.tradeName }),
        ...(dto.abn !== undefined && { abn: dto.abn }),
        ...(dto.taxCode !== undefined && { taxCode: dto.taxCode }),
        ...(dto.legalAddress !== undefined && { legalAddress: dto.legalAddress }),
        ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail }),
        ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.specialisations !== undefined && { specialisations: dto.specialisations }),
      },
    });

    return updated;
  }

  // ── Warehouses ────────────────────────────────────────────────────────────

  async addWarehouse(vendorCompanyId: string, dto: CreateWarehouseDto, user: AuthenticatedUser) {
    const company = await this.prisma.company.findFirst({
      where: { id: vendorCompanyId, type: CompanyType.VENDOR },
    });

    if (!company) {
      throw new NotFoundException(ERR.vendors.notFound);
    }

    await this.validateVendorAccess(vendorCompanyId, user);

    return this.prisma.warehouseLocation.create({
      data: {
        companyId: vendorCompanyId,
        name: dto.name,
        city: dto.city,
        postcode: dto.postcode,
        address: dto.address,
      },
    });
  }

  async updateWarehouse(
    vendorCompanyId: string,
    warehouseId: string,
    dto: UpdateWarehouseDto,
    user: AuthenticatedUser,
  ) {
    const company = await this.prisma.company.findFirst({
      where: { id: vendorCompanyId, type: CompanyType.VENDOR },
    });

    if (!company) {
      throw new NotFoundException(ERR.vendors.notFound);
    }

    await this.validateVendorAccess(vendorCompanyId, user);

    const warehouse = await this.prisma.warehouseLocation.findFirst({
      where: { id: warehouseId, companyId: vendorCompanyId },
    });

    if (!warehouse) {
      throw new NotFoundException(ERR.vendors.warehouseNotFound);
    }

    return this.prisma.warehouseLocation.update({
      where: { id: warehouseId },
      data: {
        name: dto.name,
        city: dto.city,
        postcode: dto.postcode,
        address: dto.address,
      },
    });
  }

  async deleteWarehouse(vendorCompanyId: string, warehouseId: string, user: AuthenticatedUser) {
    const company = await this.prisma.company.findFirst({
      where: { id: vendorCompanyId, type: CompanyType.VENDOR },
    });

    if (!company) {
      throw new NotFoundException(ERR.vendors.notFound);
    }

    await this.validateVendorAccess(vendorCompanyId, user);

    const warehouse = await this.prisma.warehouseLocation.findFirst({
      where: { id: warehouseId, companyId: vendorCompanyId },
    });

    if (!warehouse) {
      throw new NotFoundException(ERR.vendors.warehouseNotFound);
    }

    await this.prisma.warehouseLocation.delete({ where: { id: warehouseId } });

    return { success: true };
  }

  // ── Representatives (US-3.12) ─────────────────────────────────────────────

  async getRepresentatives(vendorCompanyId: string, user: AuthenticatedUser) {
    const company = await this.prisma.company.findFirst({
      where: { id: vendorCompanyId, type: CompanyType.VENDOR },
    });

    if (!company) {
      throw new NotFoundException(ERR.vendors.notFound);
    }

    await this.validateVendorAccess(vendorCompanyId, user);

    const users = await this.prisma.user.findMany({
      where: { companyId: vendorCompanyId, role: UserRole.VENDOR },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        position: true,
        role: true,
      },
    });

    return users;
  }
}
