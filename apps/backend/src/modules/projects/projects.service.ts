import { ProjectListQueryDto, buildPaginationMeta } from '@forethread/shared-types';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LocationType, Prisma, ProjectStatus, UserRole, UserStatus } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

// ── Valid status transitions ─────────────────────────────────────────────────

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  [ProjectStatus.PLANNED]: [ProjectStatus.ONGOING, ProjectStatus.ARCHIVED],
  [ProjectStatus.ONGOING]: [ProjectStatus.COMPLETED, ProjectStatus.ARCHIVED],
  [ProjectStatus.COMPLETED]: [ProjectStatus.ARCHIVED],
  [ProjectStatus.ARCHIVED]: [],
};

// ── Inline DTOs (backend-only, class-validator decorated DTOs in shared-types) ──

interface CreateProjectInput {
  name: string;
  description?: string;
  type?: string;
  status?: string;
  locations: {
    type: 'DELIVERY' | 'STORAGE';
    address: string;
    label?: string;
    isDefault: boolean;
  }[];
  assignedUserIds: string[];
  plannedBudget?: number;
  currency?: string;
  pointOfContactId?: string;
  startDate?: string;
  expectedEndDate?: string;
}

interface UpdateProjectInput {
  name?: string;
  description?: string;
  type?: string;
  status?: string;
  locations?: {
    type: 'DELIVERY' | 'STORAGE';
    address: string;
    label?: string;
    isDefault: boolean;
  }[];
  assignedUserIds?: string[];
  plannedBudget?: number;
  currency?: string;
  pointOfContactId?: string;
  startDate?: string;
  expectedEndDate?: string;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List Projects ──────────────────────────────────────────────────────────

  async listProjects(query: ProjectListQueryDto, user: AuthenticatedUser) {
    const sortBy = query.sortBy ?? 'createdAt';
    const sortDir = query.sortDir ?? 'desc';

    const where: Prisma.ProjectWhereInput = {};

    // Scope by role
    if (user.role === UserRole.SUPER_ADMIN) {
      // SuperAdmin sees all projects across companies
    } else if (user.role === UserRole.COMPANY_ADMIN) {
      // CompanyAdmin sees all projects in their company
      if (user.companyId) where.companyId = user.companyId;
    } else {
      // Other roles see only projects they're a member of
      if (user.companyId) where.companyId = user.companyId;
      where.members = { some: { userId: user.id } };
    }

    // Filter by status — exclude Archived by default
    if (query.status) {
      where.status = query.status as ProjectStatus;
    } else {
      where.status = { not: ProjectStatus.ARCHIVED };
    }

    // Search by name or description
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.ProjectOrderByWithRelationInput = {};
    if (sortBy === 'name') orderBy.name = sortDir;
    else if (sortBy === 'status') orderBy.status = sortDir;
    else if (sortBy === 'startDate') orderBy.startDate = sortDir;
    else orderBy.createdAt = sortDir;

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy,
        include: {
          locations: true,
          _count: { select: { members: true } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items: items.map((p) => {
        const defaultDelivery = p.locations.find((l) => l.type === 'DELIVERY' && l.isDefault);
        const defaultStorage = p.locations.find((l) => l.type === 'STORAGE' && l.isDefault);
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          status: p.status,
          type: p.type,
          defaultDeliveryLocation: defaultDelivery?.address ?? '',
          defaultStorageLocation: defaultStorage?.address ?? '',
          memberCount: p._count.members,
          startDate: p.startDate?.toISOString() ?? null,
          expectedEndDate: p.expectedEndDate?.toISOString() ?? null,
          createdAt: p.createdAt.toISOString(),
        };
      }),
      meta: buildPaginationMeta(query.page ?? 1, query.take, total),
    };
  }

  // ── Create Project ─────────────────────────────────────────────────────────

  async createProject(dto: CreateProjectInput, user: AuthenticatedUser) {
    // Validate locations
    this.validateLocations(dto.locations);

    // Validate expectedEndDate > startDate
    if (dto.startDate && dto.expectedEndDate) {
      if (new Date(dto.expectedEndDate) <= new Date(dto.startDate)) {
        throw new BadRequestException(ERR.projects.endDateBeforeStart);
      }
    }

    // Check name uniqueness within company
    const existingProject = await this.prisma.project.findUnique({
      where: {
        companyId_name: { companyId: user.companyId ?? '', name: dto.name },
      },
    });

    if (existingProject) {
      throw new ConflictException(ERR.projects.duplicateName);
    }

    // Determine assigned user IDs
    let assignedUserIds: string[];
    if (user.role === UserRole.PROCUREMENT_OFFICER) {
      // PO can only assign themselves
      assignedUserIds = [user.id];
    } else {
      // Ensure creator is included
      assignedUserIds = [...new Set([...dto.assignedUserIds, user.id])];
    }

    // Validate assigned users are active and in the same company
    await this.validateCompanyUsers(assignedUserIds, user.companyId ?? '');

    // Validate point of contact if provided
    if (dto.pointOfContactId) {
      await this.validateCompanyUsers([dto.pointOfContactId], user.companyId ?? '');
    }

    // Create project with locations and members in a transaction
    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          companyId: user.companyId ?? '',
          name: dto.name,
          description: dto.description,
          type: dto.type,
          status: (dto.status as ProjectStatus) ?? 'PLANNED',
          plannedBudget:
            dto.plannedBudget !== null && dto.plannedBudget !== undefined
              ? new Prisma.Decimal(dto.plannedBudget)
              : null,
          currency: dto.currency ?? 'AUD',
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          expectedEndDate: dto.expectedEndDate ? new Date(dto.expectedEndDate) : null,
          pointOfContactId: dto.pointOfContactId,
          createdByUserId: user.id,
          locations: {
            create: dto.locations.map((loc) => ({
              type: loc.type as LocationType,
              address: loc.address,
              label: loc.label,
              isDefault: loc.isDefault,
            })),
          },
          members: {
            create: assignedUserIds.map((userId) => ({
              userId,
              assignedByUserId: user.id,
            })),
          },
        },
      });

      return created;
    });

    return this.getProject(project.id);
  }

  // ── Get Project Detail ─────────────────────────────────────────────────────

  async getProject(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        locations: true,
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
            assignedBy: { select: { id: true, name: true } },
          },
        },
        pointOfContact: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!project) throw new NotFoundException(ERR.projects.notFound);

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      type: project.type,
      locations: project.locations.map((l) => ({
        id: l.id,
        type: l.type,
        address: l.address,
        label: l.label,
        isDefault: l.isDefault,
      })),
      assignedUsers: project.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.user.role,
        assignedAt: m.assignedAt.toISOString(),
        assignedBy: m.assignedBy ? { id: m.assignedBy.id, name: m.assignedBy.name } : undefined,
      })),
      plannedBudget: project.plannedBudget ? Number(project.plannedBudget) : null,
      usedBudget: 0, // Epic 5 — PO module
      currency: project.currency,
      startDate: project.startDate?.toISOString() ?? null,
      expectedEndDate: project.expectedEndDate?.toISOString() ?? null,
      pointOfContact: project.pointOfContact,
      createdBy: project.createdBy,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      activeBom: null, // Epic 7 — BOM module
      rfqCount: 0,
      poCount: 0,
      invoiceCount: 0,
      vendorCount: 0,
    };
  }

  // ── Update Project ─────────────────────────────────────────────────────────

  async updateProject(id: string, dto: UpdateProjectInput, user: AuthenticatedUser) {
    const existing = await this.prisma.project.findUnique({
      where: { id },
      select: { companyId: true, status: true, name: true },
    });

    if (!existing) throw new NotFoundException(ERR.projects.notFound);

    // ProcurementOfficer restrictions
    if (user.role === UserRole.PROCUREMENT_OFFICER) {
      if (dto.assignedUserIds) {
        throw new ForbiddenException(ERR.projects.cannotChangeAssignedUsers);
      }
      if (dto.status === ProjectStatus.ARCHIVED) {
        throw new ForbiddenException(ERR.projects.cannotArchive);
      }
    }

    // Validate status transition
    if (dto.status && dto.status !== existing.status) {
      const validTransitions = VALID_STATUS_TRANSITIONS[existing.status] || [];
      if (!validTransitions.includes(dto.status)) {
        throw new BadRequestException(
          ERR.projects.invalidStatusTransition(existing.status, dto.status),
        );
      }
    }

    // Validate name uniqueness if changed
    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.prisma.project.findUnique({
        where: {
          companyId_name: { companyId: existing.companyId, name: dto.name },
        },
      });
      if (duplicate) {
        throw new ConflictException(ERR.projects.duplicateName);
      }
    }

    // Validate locations if provided
    if (dto.locations) {
      this.validateLocations(dto.locations);
    }

    // Validate expectedEndDate > startDate
    if (dto.startDate && dto.expectedEndDate) {
      if (new Date(dto.expectedEndDate) <= new Date(dto.startDate)) {
        throw new BadRequestException(ERR.projects.endDateBeforeStart);
      }
    }

    // Validate assigned users if provided
    if (dto.assignedUserIds) {
      await this.validateCompanyUsers(dto.assignedUserIds, existing.companyId);
    }

    // Validate point of contact if provided
    if (dto.pointOfContactId) {
      await this.validateCompanyUsers([dto.pointOfContactId], existing.companyId);
    }

    await this.prisma.$transaction(async (tx) => {
      // Build update data
      const updateData: Prisma.ProjectUpdateInput = {};

      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.type !== undefined) updateData.type = dto.type;
      if (dto.status !== undefined) updateData.status = dto.status as ProjectStatus;
      if (dto.plannedBudget !== undefined) {
        updateData.plannedBudget =
          dto.plannedBudget !== null && dto.plannedBudget !== undefined
            ? new Prisma.Decimal(dto.plannedBudget)
            : null;
      }
      if (dto.currency !== undefined) updateData.currency = dto.currency;
      if (dto.startDate !== undefined) {
        updateData.startDate = dto.startDate ? new Date(dto.startDate) : null;
      }
      if (dto.expectedEndDate !== undefined) {
        updateData.expectedEndDate = dto.expectedEndDate ? new Date(dto.expectedEndDate) : null;
      }
      if (dto.pointOfContactId !== undefined) {
        updateData.pointOfContact = dto.pointOfContactId
          ? { connect: { id: dto.pointOfContactId } }
          : { disconnect: true };
      }

      await tx.project.update({
        where: { id },
        data: updateData,
      });

      // Full replacement of locations if provided
      if (dto.locations) {
        await tx.projectLocation.deleteMany({ where: { projectId: id } });
        await tx.projectLocation.createMany({
          data: dto.locations.map((loc) => ({
            projectId: id,
            type: loc.type as LocationType,
            address: loc.address,
            label: loc.label,
            isDefault: loc.isDefault,
          })),
        });
      }
    });

    return this.getProject(id);
  }

  // ── Add Members ────────────────────────────────────────────────────────────

  async addMembers(projectId: string, userIds: string[], user: AuthenticatedUser) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    });

    if (!project) throw new NotFoundException(ERR.projects.notFound);

    // Validate all users are active and in the same company
    await this.validateCompanyUsers(userIds, project.companyId);

    // Get existing members to skip duplicates
    const existingMembers = await this.prisma.projectMember.findMany({
      where: { projectId, userId: { in: userIds } },
      select: { userId: true },
    });

    const existingUserIds = new Set(existingMembers.map((m) => m.userId));
    const newUserIds = userIds.filter((id) => !existingUserIds.has(id));

    if (newUserIds.length > 0) {
      await this.prisma.projectMember.createMany({
        data: newUserIds.map((userId) => ({
          projectId,
          userId,
          assignedByUserId: user.id,
        })),
      });
    }

    return this.getProjectMembers(projectId);
  }

  // ── Remove Member ──────────────────────────────────────────────────────────

  async removeMember(projectId: string, userId: string, _user: AuthenticatedUser) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { createdByUserId: true },
    });

    if (!project) throw new NotFoundException(ERR.projects.notFound);

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (!membership) throw new NotFoundException(ERR.projects.userNotMember);

    // Cannot remove last member
    const memberCount = await this.prisma.projectMember.count({ where: { projectId } });
    if (memberCount <= 1) {
      throw new BadRequestException(ERR.projects.cannotRemoveLastMember);
    }

    // Cannot remove auto-assigned PO creator
    if (userId === project.createdByUserId) {
      const creator = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (creator?.role === UserRole.PROCUREMENT_OFFICER) {
        throw new BadRequestException(ERR.projects.cannotRemoveCreator);
      }
    }

    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });

    return this.getProjectMembers(projectId);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async getProjectMembers(projectId: string) {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        assignedBy: { select: { id: true, name: true } },
      },
    });

    return {
      members: members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.user.role,
        assignedAt: m.assignedAt.toISOString(),
        assignedBy: m.assignedBy ? { id: m.assignedBy.id, name: m.assignedBy.name } : undefined,
      })),
    };
  }

  private validateLocations(
    locations: { type: string; address: string; label?: string; isDefault: boolean }[],
  ) {
    const deliveryDefaults = locations.filter((l) => l.type === 'DELIVERY' && l.isDefault);
    const storageDefaults = locations.filter((l) => l.type === 'STORAGE' && l.isDefault);
    const hasDelivery = locations.some((l) => l.type === 'DELIVERY');
    const hasStorage = locations.some((l) => l.type === 'STORAGE');

    if (!hasDelivery) {
      throw new BadRequestException(ERR.projects.deliveryLocationRequired);
    }
    if (!hasStorage) {
      throw new BadRequestException(ERR.projects.storageLocationRequired);
    }
    if (deliveryDefaults.length === 0) {
      throw new BadRequestException(ERR.projects.defaultDeliveryRequired);
    }
    if (storageDefaults.length === 0) {
      throw new BadRequestException(ERR.projects.defaultStorageRequired);
    }
    if (deliveryDefaults.length > 1) {
      throw new BadRequestException(ERR.projects.onlyOneDefaultDelivery);
    }
    if (storageDefaults.length > 1) {
      throw new BadRequestException(ERR.projects.onlyOneDefaultStorage);
    }
  }

  private async validateCompanyUsers(userIds: string[], companyId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        companyId,
        status: UserStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (users.length !== userIds.length) {
      const foundIds = new Set(users.map((u) => u.id));
      const invalidIds = userIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(ERR.projects.usersNotFoundOrInactive(invalidIds.join(', ')));
    }
  }
}
