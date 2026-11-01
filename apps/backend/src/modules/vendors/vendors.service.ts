import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanyType, Prisma, UserRole, UserStatus, VendorCategory } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, AuditAction } from '../audit/audit.service';

import { assertVendorAccess } from './vendor-access.util';
import {
  AuthUser,
  CreateOneOffVendorDto,
  CreateVendorRepresentativeDto,
  CreateWarehouseDto,
  ResolveVendorSelectionDto,
  UNCATEGORISED,
  UpdateVendorCategoriesDto,
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
  /** Deactivated reps are reported as `INACTIVE`, never collapsed into
   *  `INVITED` — a caller choosing RFQ recipients must be able to see that a
   *  rep is unsendable (CONTEXT.md → Sales Rep). */
  status: 'ACTIVE' | 'INVITED' | 'INACTIVE';
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
  /** Set for a one-off vendor (FOR-395): the only project it can be used on. */
  oneOffProject: { id: string; name: string } | null;
}

const VENDOR_CATEGORY_KEYS = new Set<string>(Object.values(VendorCategory));

/**
 * Translate a comma-separated category filter into a `CompanyVendorAssignment`
 * where-fragment. Unknown keys are dropped rather than passed to Prisma, so a
 * stale bookmark degrades to "no filter" instead of a 500.
 *
 * {@link UNCATEGORISED} matches assignments with an empty `categories` array and
 * ORs with any real categories in the same request — "Electrical or untagged"
 * is a legitimate thing to ask for while a vendor book is being tidied up.
 */
export function buildCategoryWhere(category?: string): Record<string, unknown> {
  if (!category) return {};

  const requested = category
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  const known = requested.filter((c) => VENDOR_CATEGORY_KEYS.has(c)) as VendorCategory[];
  const wantsUncategorised = requested.includes(UNCATEGORISED);

  if (known.length === 0 && !wantsUncategorised) return {};
  if (known.length === 0) return { categories: { isEmpty: true } };
  if (!wantsUncategorised) return { categories: { hasSome: known } };

  return { OR: [{ categories: { hasSome: known } }, { categories: { isEmpty: true } }] };
}

/**
 * Which one-off vendors (FOR-395) a vendor query sees. By default none: a
 * one-off belongs to its project and stays out of company-wide lists.
 * `projectIds` admits the one-offs of those projects (RFQ/PO wizards),
 * `includeOneOff` admits all of them (the vendor list filter), and `oneOffOnly`
 * drops full vendors (the project Vendors tab).
 */
export function buildOneOffWhere(opts: {
  includeOneOff?: boolean;
  projectIds?: string[];
  oneOffOnly?: boolean;
}): Prisma.CompanyVendorAssignmentWhereInput {
  const projectIds = (opts.projectIds ?? []).filter(Boolean);
  const oneOffs: Prisma.CompanyVendorAssignmentWhereInput = opts.includeOneOff
    ? { oneOffProjectId: { not: null } }
    : { oneOffProjectId: { in: projectIds } };
  if (opts.oneOffOnly) return oneOffs;
  if (!opts.includeOneOff && projectIds.length === 0) return { oneOffProjectId: null };
  return opts.includeOneOff ? {} : { OR: [{ oneOffProjectId: null }, oneOffs] };
}

/** Comma-separated id list → array (empty entries dropped). */
function splitIds(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

@Injectable()
export class VendorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

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

    Object.assign(assignmentWhere, buildCategoryWhere(query.category));
    assignmentWhere['AND'] = [
      buildOneOffWhere({
        includeOneOff: query.includeOneOff,
        projectIds: splitIds(query.projectIds),
        oneOffOnly: query.oneOffOnly,
      }),
    ];

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
        oneOffProject: { select: { id: true, name: true } },
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
        status:
          u.status === UserStatus.ACTIVE
            ? 'ACTIVE'
            : u.status === UserStatus.INACTIVE
              ? 'INACTIVE'
              : 'INVITED',
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
        oneOffProject: a.oneOffProject,
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

  // ── One-off vendors (FOR-395) ─────────────────────────────────────────────

  /**
   * Add a vendor for one project only: a light record (name + email, no portal
   * invite or onboarding) that the buyer can send an RFQ or PO to straight away.
   * An existing vendor company with the same email is reused, as the create
   * dialog does. If it is already a full vendor of this contractor, nothing
   * changes (it can already be used anywhere). If it is already a one-off of
   * this project, nothing changes either. A one-off of another project is a
   * conflict: the buyer promotes it instead.
   */
  async createOneOffVendor(dto: CreateOneOffVendorDto, user: AuthenticatedUser) {
    if (!user.companyId) throw new ForbiddenException(ERR.general.accessDenied);
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, companyId: user.companyId },
      select: { id: true, name: true },
    });
    if (!project) throw new NotFoundException(ERR.vendors.projectNotFound);

    const contactEmail = dto.contactEmail.trim().toLowerCase();
    const vendor =
      (await this.prisma.company.findFirst({
        where: {
          type: CompanyType.VENDOR,
          contactEmail: { equals: contactEmail, mode: 'insensitive' },
        },
        select: { id: true, legalName: true },
      })) ??
      (await this.prisma.company.create({
        data: {
          type: CompanyType.VENDOR,
          legalName: dto.legalName.trim(),
          contactEmail,
          // An empty phone field is stored as no phone.
          contactPhone: dto.contactPhone?.trim() ? dto.contactPhone.trim() : null,
        },
        select: { id: true, legalName: true },
      }));

    const existing = await this.prisma.companyVendorAssignment.findUnique({
      where: { vendorId_contractorId: { vendorId: vendor.id, contractorId: user.companyId } },
      select: { oneOffProjectId: true },
    });
    if (existing?.oneOffProjectId && existing.oneOffProjectId !== project.id) {
      throw new ConflictException(ERR.vendors.oneOffOnOtherProject);
    }
    if (!existing) {
      await this.prisma.companyVendorAssignment.create({
        data: { vendorId: vendor.id, contractorId: user.companyId, oneOffProjectId: project.id },
      });
    }

    const oneOff = existing ? existing.oneOffProjectId !== null : true;
    return {
      companyId: vendor.id,
      companyName: vendor.legalName,
      oneOffProject: oneOff ? project : null,
      /** True when the email matched a vendor this contractor already had. */
      alreadyAssigned: Boolean(existing),
    };
  }

  /** Make a one-off vendor a full vendor of the caller's company (FOR-395). */
  async promoteOneOffVendor(vendorCompanyId: string, user: AuthenticatedUser) {
    if (!user.companyId) throw new ForbiddenException(ERR.general.accessDenied);
    const { count } = await this.prisma.companyVendorAssignment.updateMany({
      where: {
        vendorId: vendorCompanyId,
        contractorId: user.companyId,
        oneOffProjectId: { not: null },
      },
      data: { oneOffProjectId: null },
    });
    if (count === 0) throw new NotFoundException(ERR.vendors.notOneOff);
    return { companyId: vendorCompanyId, oneOffProject: null };
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
    await assertVendorAccess(this.prisma, vendorCompanyId, user);
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

    // The viewer's OWN classification of this vendor (ADR-0018). Another
    // contractor's categories are none of their business, and a vendor viewing
    // itself has none — it holds `specialisations`, not categories.
    const assignment =
      user.role === UserRole.VENDOR || !user.companyId
        ? null
        : await this.prisma.companyVendorAssignment.findUnique({
            where: {
              vendorId_contractorId: { vendorId: vendorCompanyId, contractorId: user.companyId },
            },
            select: {
              categories: true,
              oneOffProject: { select: { id: true, name: true } },
            },
          });

    return {
      ...company,
      categories: assignment?.categories ?? [],
      oneOffProject: assignment?.oneOffProject ?? null,
    };
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

  // ── Vendor Categories (ADR-0018) ──────────────────────────────────────────

  /**
   * Set the Vendor Categories the requesting contractor applies to one of its
   * vendors. Replace-semantics; an empty array clears them.
   *
   * A Vendor Category is a fact about the *relationship*, so it is written to
   * the caller's own `CompanyVendorAssignment` and is invisible to every other
   * contractor. Vendors cannot set their own — that is what
   * `Company.specialisations` is for, and it is descriptive only.
   */
  async updateVendorCategories(
    vendorCompanyId: string,
    dto: UpdateVendorCategoriesDto,
    user: AuthenticatedUser,
  ) {
    if (user.role === UserRole.VENDOR || !user.companyId) {
      throw new ForbiddenException(ERR.vendors.categoriesNeedContractor);
    }

    const company = await this.prisma.company.findFirst({
      where: { id: vendorCompanyId, type: CompanyType.VENDOR },
    });
    if (!company) {
      throw new NotFoundException(ERR.vendors.notFound);
    }

    // Also serves as the authorisation check: no assignment, no access.
    const { count } = await this.prisma.companyVendorAssignment.updateMany({
      where: { vendorId: vendorCompanyId, contractorId: user.companyId },
      data: { categories: { set: dto.categories } },
    });

    if (count === 0) {
      throw new ForbiddenException(ERR.vendors.accessDenied);
    }

    await this.auditService.log({
      action: AuditAction.VENDOR_CATEGORIES_UPDATED,
      performedById: user.id,
      targetType: 'CompanyVendorAssignment',
      targetId: vendorCompanyId,
      targetLabel: company.legalName,
      metadata: { categories: dto.categories },
    });

    return { vendorId: vendorCompanyId, categories: dto.categories };
  }

  /**
   * Resolve a category filter to every matching vendor id plus the ids of their
   * **sendable** reps — the server-side backing for the RFQ wizard's "Add All".
   *
   * Deliberately unpaginated: "every Electrical vendor" that silently meant
   * "those on page 1" is the defect this replaces. `INACTIVE` reps are dropped
   * here rather than in the browser so bulk selection can never reach a
   * recipient a single selection could not (CONTEXT.md).
   *
   * Vendors with no sendable rep are still returned — they fall back to the
   * company contact email on send, the same contract the RFQ send already uses.
   *
   * Returns summaries rather than bare ids: the caller must be able to render a
   * vendor it selected but never loaded (the match may lie beyond the page the
   * picker is showing), which is the whole reason this endpoint exists.
   */
  async resolveVendorSelection(dto: ResolveVendorSelectionDto, user: AuthenticatedUser) {
    if (!user.companyId) return { vendors: [] };

    const where: Record<string, unknown> = {
      contractorId: user.companyId,
      ...buildCategoryWhere(dto.category),
      AND: [buildOneOffWhere({ projectIds: dto.projectIds })],
    };

    if (dto.search) {
      where['vendor'] = {
        OR: [
          { legalName: { contains: dto.search, mode: 'insensitive' } },
          { contactEmail: { contains: dto.search, mode: 'insensitive' } },
        ],
      };
    }

    const assignments = await this.prisma.companyVendorAssignment.findMany({
      where,
      orderBy: { assignedAt: 'desc' },
      select: {
        vendorId: true,
        categories: true,
        vendor: {
          select: {
            legalName: true,
            contactEmail: true,
            specialisations: true,
            users: {
              where: { role: UserRole.VENDOR, status: { not: UserStatus.INACTIVE } },
              select: { id: true, name: true, email: true, position: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    return {
      vendors: assignments.map((a) => ({
        companyId: a.vendorId,
        companyName: a.vendor.legalName,
        companyEmail: a.vendor.contactEmail,
        categories: a.categories,
        specialisations: a.vendor.specialisations,
        // Whole reps, not bare ids: the picker has to be able to *name* who a
        // match will email. Returning ids alone made an off-page vendor render
        // as "All contacts (company email)" while specific reps were in fact
        // selected — the UI under-reporting the real recipient set.
        reps: a.vendor.users,
      })),
    };
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

  /**
   * Adds a representative to a vendor company WITHOUT sending an invitation
   * email (FOR-272). Mirrors the access rules of the rest of the profile
   * editing surface (vendor managing its own company OR a contractor managing
   * an assigned vendor) via {@link validateVendorAccess} — unlike the
   * email-sending invite flow, which is vendor-only.
   *
   * The representative is stored as a vendor `User` with INVITED status and no
   * invitation token, so it appears in the representatives list immediately and
   * can later be sent a real invitation via the resend action.
   */
  async addRepresentative(
    vendorCompanyId: string,
    dto: CreateVendorRepresentativeDto,
    user: AuthenticatedUser,
  ) {
    const company = await this.prisma.company.findFirst({
      where: { id: vendorCompanyId, type: CompanyType.VENDOR },
    });

    if (!company) {
      throw new NotFoundException(ERR.vendors.notFound);
    }

    await this.validateVendorAccess(vendorCompanyId, user);

    // Same duplicate check as the invite flow (email is globally unique).
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(ERR.vendors.userEmailInUse);
    }

    const rep = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? null,
        position: dto.position ?? '',
        role: UserRole.VENDOR,
        status: UserStatus.INVITED,
        companyId: vendorCompanyId,
        invitedByUserId: user.id,
      },
    });

    await this.auditService.log({
      action: AuditAction.VENDOR_USER_ADDED,
      performedById: user.id,
      targetType: 'User',
      targetId: rep.id,
      targetLabel: rep.name,
      metadata: { companyId: vendorCompanyId, email: dto.email },
    });

    return {
      id: rep.id,
      name: rep.name,
      email: rep.email,
      phone: rep.phone,
      position: rep.position,
      status: rep.status,
    };
  }

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
        status: true,
        createdAt: true,
        invitationToken: true,
      },
    });

    // Expose only *whether* an invitation is pending, never the token itself.
    return users.map(({ invitationToken, ...rest }) => ({
      ...rest,
      invitePending: invitationToken !== null,
    }));
  }

  async getRepresentative(vendorCompanyId: string, userId: string, user: AuthenticatedUser) {
    const company = await this.prisma.company.findFirst({
      where: { id: vendorCompanyId, type: CompanyType.VENDOR },
    });

    if (!company) {
      throw new NotFoundException(ERR.vendors.notFound);
    }

    await this.validateVendorAccess(vendorCompanyId, user);

    const rep = await this.prisma.user.findFirst({
      where: { id: userId, companyId: vendorCompanyId, role: UserRole.VENDOR },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        position: true,
        department: true,
        avatarUrl: true,
        role: true,
        status: true,
        createdAt: true,
        invitationToken: true,
        invitedBy: { select: { name: true } },
      },
    });

    if (!rep) {
      throw new NotFoundException(ERR.vendors.representativeNotFound);
    }

    const { invitationToken, invitedBy, ...rest } = rep;
    return {
      ...rest,
      invitePending: invitationToken !== null,
      invitedByName: invitedBy?.name ?? null,
      companyId: vendorCompanyId,
      companyName: company.legalName,
    };
  }

  /**
   * Deletes a representative record. Per ADR-0016 authority follows
   * activation: never-activated reps (INVITED) may be removed by the vendor or
   * any assigned contractor; deactivated reps (INACTIVE) only by the vendor;
   * activated reps (ACTIVE) by nobody — deactivation via the vendor's own user
   * management must come first. Reps referenced by RFQ contact selections are
   * never deletable, because recipient resolution and document history hang
   * off those rows.
   */
  async removeRepresentative(vendorCompanyId: string, userId: string, user: AuthenticatedUser) {
    const company = await this.prisma.company.findFirst({
      where: { id: vendorCompanyId, type: CompanyType.VENDOR },
    });

    if (!company) {
      throw new NotFoundException(ERR.vendors.notFound);
    }

    await this.validateVendorAccess(vendorCompanyId, user);

    const rep = await this.prisma.user.findFirst({
      where: { id: userId, companyId: vendorCompanyId, role: UserRole.VENDOR },
    });

    if (!rep) {
      throw new NotFoundException(ERR.vendors.representativeNotFound);
    }

    if (rep.status === UserStatus.ACTIVE) {
      throw new ConflictException(ERR.vendors.cannotRemoveActiveRepresentative);
    }

    if (rep.status === UserStatus.INACTIVE && user.role !== UserRole.VENDOR) {
      throw new ForbiddenException(ERR.vendors.cannotRemoveDeactivatedRepresentative);
    }

    const rfqReferences = await this.prisma.rfqVendorContact.count({
      where: { userId },
    });

    if (rfqReferences > 0) {
      throw new ConflictException(ERR.vendors.representativeReferencedByRfqs);
    }

    await this.prisma.user.delete({ where: { id: userId } });

    await this.auditService.log({
      action: AuditAction.VENDOR_USER_REMOVED,
      performedById: user.id,
      targetType: 'User',
      targetId: rep.id,
      targetLabel: rep.name,
      metadata: { companyId: vendorCompanyId, email: rep.email },
    });

    return { success: true };
  }
}
