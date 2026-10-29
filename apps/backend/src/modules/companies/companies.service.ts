import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CompanyType, CompanyStatus, DocumentType, UserRole, VendorCategory } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsUrl,
  Matches,
  IsDateString,
} from 'class-validator';

import { ERR } from '../../common/constants/error-messages.const';
import { PrismaService } from '../../prisma/prisma.service';

export class AssignVendorsDto {
  /** NB: despite the name these are VENDOR ids — see assignVendorsToContractor. */
  @IsArray()
  @IsString({ each: true })
  contractorIds!: string[];

  /** Optional Vendor Categories for the assignments created here (ADR-0018). */
  @IsOptional()
  @IsArray()
  @IsEnum(VendorCategory, { each: true })
  categories?: VendorCategory[];
}

export class UploadCompanyDocumentDto {
  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

/** FOR-260: the human-approved document data saved by the review step.
 *  Replace semantics — omitting `expiresAt` clears the stored expiry. */
export class ReviewCompanyDocumentDto {
  @IsEnum(DocumentType)
  type!: DocumentType;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class CreateCompanyDto {
  @IsEnum(CompanyType)
  type!: CompanyType;

  @IsString()
  legalName!: string;

  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'ABN must be exactly 11 digits' })
  abn?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,11}$/, { message: 'Tax code must be 1-11 digits' })
  taxCode?: string;

  @IsOptional()
  @IsString()
  legalAddress?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialisations?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedContractorIds?: string[];

  /**
   * Vendor Categories to stamp on the assignment(s) created for this vendor
   * (ADR-0018). Applies to every contractor assigned in the same call — they
   * are all acting on the creator's classification at this point; each can
   * diverge later via PATCH /vendors/:id/categories.
   */
  @IsOptional()
  @IsArray()
  @IsEnum(VendorCategory, { each: true })
  categories?: VendorCategory[];
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'ABN must be exactly 11 digits' })
  abn?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,11}$/, { message: 'Tax code must be 1-11 digits' })
  taxCode?: string;

  @IsOptional()
  @IsString()
  legalAddress?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialisations?: string[];

  /** Approving a material request also creates its draft RFQ (FOR-396). Company Admin only. */
  @IsOptional()
  @IsBoolean()
  autoConvertApprovedMrToRfq?: boolean;
}

export class CompanyListQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value))
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value))
  limit?: number = 25;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(CompanyType)
  type?: CompanyType;

  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;
}

interface RequestingUser {
  id: string;
  role: string;
  companyId: string | null;
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCompanies(query: CompanyListQueryDto, requestingUser: RequestingUser) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 25, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // CompanyAdmin sees only their own company
    if (requestingUser.role === UserRole.COMPANY_ADMIN && requestingUser.companyId) {
      where['id'] = requestingUser.companyId;
    }

    if (query.search) {
      where['OR'] = [
        { legalName: { contains: query.search, mode: 'insensitive' } },
        { tradeName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.type) where['type'] = query.type;
    if (query.status) where['status'] = query.status;

    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { legalName: 'asc' },
        include: { _count: { select: { users: true } } },
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createCompany(dto: CreateCompanyDto, user?: RequestingUser) {
    // Non-SUPER_ADMIN users can only create VENDOR companies (US-3.01)
    if (user && user.role !== UserRole.SUPER_ADMIN) {
      if (dto.type !== CompanyType.VENDOR) {
        throw new ForbiddenException(ERR.general.accessDenied);
      }
      if (!user.companyId) {
        throw new ForbiddenException(ERR.general.accessDenied);
      }
    }

    if (dto.type === CompanyType.VENDOR && !dto.contactEmail) {
      throw new BadRequestException(ERR.companies.contactEmailRequired);
    }

    // `categories` lives on the assignment, not the Company — keep it out of
    // the company payload (ADR-0018).
    const { assignedContractorIds, categories, ...companyData } = dto;

    // Reuse an existing vendor row when one matches by contactEmail or abn.
    // Why: contractors create vendors via the same dialog and would otherwise
    // produce duplicate Company rows for the same real-world vendor.
    const existingVendor =
      dto.type === CompanyType.VENDOR
        ? await this.findExistingVendor(dto.contactEmail, dto.abn)
        : null;

    const company = existingVendor ?? (await this.prisma.company.create({ data: companyData }));

    if (dto.type === CompanyType.VENDOR) {
      const contractorIds = new Set<string>();
      if (user && user.role !== UserRole.SUPER_ADMIN && user.companyId) {
        contractorIds.add(user.companyId);
      }
      for (const id of assignedContractorIds ?? []) contractorIds.add(id);

      if (contractorIds.size > 0) {
        await this.prisma.companyVendorAssignment.createMany({
          data: Array.from(contractorIds).map((contractorId) => ({
            vendorId: company.id,
            contractorId,
            categories: categories ?? [],
          })),
          skipDuplicates: true,
        });
      }
    }

    return { ...company, alreadyExisted: existingVendor !== null };
  }

  private async findExistingVendor(contactEmail?: string, abn?: string) {
    const or: Array<Record<string, string>> = [];
    if (contactEmail) or.push({ contactEmail });
    if (abn) or.push({ abn });
    if (or.length === 0) return null;

    return this.prisma.company.findFirst({
      where: { type: CompanyType.VENDOR, OR: or },
    });
  }

  async getCompany(id: string, requestingUser: RequestingUser) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!company) throw new NotFoundException(ERR.companies.notFound(id));

    if (requestingUser.role === UserRole.COMPANY_ADMIN && requestingUser.companyId !== id) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    return company;
  }

  async updateCompany(id: string, dto: UpdateCompanyDto, requestingUser: RequestingUser) {
    await this.getCompany(id, requestingUser); // validates existence + access

    // Only a Super Admin may edit another company: getCompany scopes Company
    // Admins alone, which left every other role able to patch any company.
    const isSuperAdmin = requestingUser.role === UserRole.SUPER_ADMIN;
    if (!isSuperAdmin && requestingUser.companyId !== id) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }
    // Procurement automation is a company policy: Company Admin (or SA) only.
    if (
      dto.autoConvertApprovedMrToRfq !== undefined &&
      !isSuperAdmin &&
      requestingUser.role !== UserRole.COMPANY_ADMIN
    ) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    return this.prisma.company.update({ where: { id }, data: dto });
  }

  async getCompanyVendors(companyId: string) {
    const assignments = await this.prisma.companyVendorAssignment.findMany({
      where: { contractorId: companyId },
      include: { vendor: { include: { _count: { select: { users: true } } } } },
      orderBy: { assignedAt: 'desc' },
    });
    // One-off vendors (FOR-395) are included and flagged: invoice and delivery
    // pickers need every vendor the company deals with, while the PO wizards
    // offer a one-off only on its own project.
    return assignments.map((a) => ({
      ...a.vendor,
      assignedAt: a.assignedAt,
      oneOffProjectId: a.oneOffProjectId,
    }));
  }

  async assignVendorsToContractor(
    contractorId: string,
    dto: AssignVendorsDto,
    user?: RequestingUser,
  ) {
    // Non-SUPER_ADMIN users can only assign vendors to their own company
    if (user && user.role !== UserRole.SUPER_ADMIN && user.companyId !== contractorId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    const contractor = await this.prisma.company.findUnique({ where: { id: contractorId } });
    if (!contractor) throw new NotFoundException(ERR.companies.contractorNotFound);
    if (contractor.type !== CompanyType.CONTRACTOR) {
      throw new BadRequestException(ERR.companies.notContractor);
    }

    // Validate all vendor IDs exist and are Vendor type
    const vendors = await this.prisma.company.findMany({
      where: { id: { in: dto.contractorIds }, type: CompanyType.VENDOR },
    });

    if (vendors.length !== dto.contractorIds.length) {
      throw new BadRequestException(ERR.companies.invalidVendorIds);
    }

    await this.prisma.companyVendorAssignment.createMany({
      data: dto.contractorIds.map((vendorId) => ({
        vendorId,
        contractorId,
        categories: dto.categories ?? [],
      })),
      skipDuplicates: true,
    });

    return this.getCompanyVendors(contractorId);
  }

  async removeVendorFromContractor(contractorId: string, vendorId: string) {
    const deleted = await this.prisma.companyVendorAssignment.deleteMany({
      where: { contractorId, vendorId },
    });

    if (deleted.count === 0) {
      throw new NotFoundException(ERR.companies.vendorAssignmentNotFound);
    }

    return { message: 'Vendor unassigned successfully' };
  }
}
