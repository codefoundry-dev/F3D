import * as crypto from 'crypto';

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { Transform } from 'class-transformer';
import { IsString, IsEmail, IsOptional, IsEnum, MinLength } from 'class-validator';

import { ERR } from '../../common/constants/error-messages.const';
import { PermissionsService } from '../../common/permissions';
import { getAppUrlForRole } from '../../common/utils/app-url.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, AuditAction } from '../audit/audit.service';
import { EmailService } from '../notifications/email.service';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsString()
  companyId!: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  workStatus?: string;

  @IsOptional()
  @IsString()
  department?: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

const SORTABLE_USER_FIELDS = [
  'name',
  'email',
  'role',
  'status',
  'createdAt',
  'dateJoined',
] as const;

/** Frontend sends 'dateJoined' but Prisma field is 'createdAt' */
const SORT_FIELD_ALIASES: Record<string, string> = { dateJoined: 'createdAt' };

export class UserListQueryDto {
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
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' && value.includes(',') ? value.split(',') : value,
  )
  @IsEnum(UserRole, { each: true })
  role?: UserRole | UserRole[];

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  position: true,
  phone: true,
  workStatus: true,
  department: true,
  avatarUrl: true,
  role: true,
  status: true,
  companyId: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  company: { select: { id: true, legalName: true, type: true } },
} as const;

const USER_DETAIL_SELECT = {
  ...USER_SELECT,
  projectMemberships: {
    select: {
      project: { select: { id: true, name: true } },
    },
  },
} as const;

interface AuthUser {
  id: string;
  role: string;
  companyId: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async listUsers(query: UserListQueryDto, requestingUser: AuthUser) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 25, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (
      (requestingUser.role === UserRole.COMPANY_ADMIN || requestingUser.role === UserRole.VENDOR) &&
      requestingUser.companyId
    ) {
      where['companyId'] = requestingUser.companyId;
    } else if (query.companyId) {
      const ids = query.companyId.split(',').filter(Boolean);
      where['companyId'] = ids.length > 1 ? { in: ids } : ids[0];
    }

    if (query.search) {
      where['OR'] = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.role) {
      where['role'] = Array.isArray(query.role) ? { in: query.role } : query.role;
    }
    if (query.status) {
      const statuses = query.status.split(',').filter(Boolean);
      where['status'] = statuses.length > 1 ? { in: statuses } : statuses[0];
    }

    if (query.dateFrom || query.dateTo) {
      const createdAtFilter: Record<string, Date> = {};
      if (query.dateFrom) createdAtFilter['gte'] = new Date(query.dateFrom);
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        end.setHours(23, 59, 59, 999);
        createdAtFilter['lte'] = end;
      }
      where['createdAt'] = createdAtFilter;
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [(() => {
            const field = query.sortBy ?? '';
            if (!(SORTABLE_USER_FIELDS as readonly string[]).includes(field)) return 'createdAt';
            return SORT_FIELD_ALIASES[field] ?? field;
          })()]: query.sortDir ?? 'desc',
        },
        select: USER_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createUser(dto: CreateUserDto, requestingUser: AuthUser) {
    // CompanyAdmin can only create users in their own company
    if (requestingUser.role === UserRole.COMPANY_ADMIN) {
      if (dto.companyId !== requestingUser.companyId) {
        throw new ForbiddenException(ERR.users.cannotCreateForOtherCompanies);
      }
      if (dto.role === UserRole.SUPER_ADMIN) {
        throw new ForbiddenException(ERR.users.cannotAssignRole);
      }
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException(ERR.users.emailAlreadyInUse);

    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) throw new NotFoundException(ERR.companies.notFoundGeneric);

    // Generate raw invitation token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const invitationToken = await argon2.hash(rawToken);
    const invitationTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        companyId: dto.companyId,
        position: dto.position,
        phone: dto.phone,
        status: UserStatus.INVITED,
        invitedByUserId: requestingUser.id,
        invitationToken,
        invitationTokenExpiresAt,
      },
      select: USER_SELECT,
    });

    const appUrl = getAppUrlForRole(this.config, dto.role);
    const activationUrl = `${appUrl}/activate?token=${rawToken}`;

    await this.emailService.sendInvitationEmail(user.email, activationUrl, user.name);

    await this.auditService.log({
      action: AuditAction.USER_CREATED,
      performedById: requestingUser.id,
      targetType: 'User',
      targetId: user.id,
      targetLabel: user.name,
    });

    return user;
  }

  async getUser(id: string, requestingUser: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_DETAIL_SELECT,
    });

    if (!user) throw new NotFoundException(ERR.users.notFound);

    // Vendor can only access users within their own company
    if (requestingUser.role === UserRole.VENDOR && user.companyId !== requestingUser.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    // Contractor roles can access users in their own company OR in assigned vendor companies
    const isContractorRole =
      requestingUser.role === UserRole.COMPANY_ADMIN ||
      requestingUser.role === UserRole.PROCUREMENT_OFFICER;

    if (isContractorRole && user.companyId !== requestingUser.companyId) {
      // Check if the target user belongs to a vendor company assigned to this contractor
      const vendorAssignment = user.companyId
        ? await this.prisma.companyVendorAssignment.findFirst({
            where: {
              vendorId: user.companyId,
              contractorId: requestingUser.companyId ?? '',
            },
          })
        : null;

      if (!vendorAssignment) {
        throw new ForbiddenException(ERR.general.accessDenied);
      }
    }

    return {
      ...user,
      projects: user.projectMemberships.map((m) => m.project),
      projectMemberships: undefined,
    };
  }

  async updateUser(id: string, dto: UpdateUserDto, requestingUser: AuthUser) {
    const user = await this.getUser(id, requestingUser);

    // Guard: cannot demote the sole active CompanyAdmin of a company
    if (
      dto.role &&
      dto.role !== UserRole.COMPANY_ADMIN &&
      user.role === UserRole.COMPANY_ADMIN &&
      user.companyId
    ) {
      const activeAdminCount = await this.prisma.user.count({
        where: {
          companyId: user.companyId,
          role: UserRole.COMPANY_ADMIN,
          status: UserStatus.ACTIVE,
        },
      });
      if (activeAdminCount <= 1) {
        throw new BadRequestException(ERR.users.cannotChangeLastAdminRole);
      }
    }

    return this.prisma.user.update({ where: { id }, data: dto, select: USER_SELECT });
  }

  async deactivateUser(id: string, requestingUser: AuthUser) {
    const user = await this.getUser(id, requestingUser);

    if (user.status === UserStatus.INACTIVE) {
      throw new BadRequestException(ERR.users.alreadyInactive);
    }

    // Guard: cannot deactivate the sole active CompanyAdmin of a company
    if (user.role === UserRole.COMPANY_ADMIN && user.companyId) {
      const activeAdminCount = await this.prisma.user.count({
        where: {
          companyId: user.companyId,
          role: UserRole.COMPANY_ADMIN,
          status: UserStatus.ACTIVE,
        },
      });

      if (activeAdminCount <= 1) {
        throw new BadRequestException(ERR.users.cannotDeactivateLastAdmin);
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.INACTIVE,
        refreshTokenHash: null, // Invalidate all sessions
        deactivatedAt: new Date(),
      },
      select: USER_SELECT,
    });

    await this.emailService.sendDeactivationEmail(updatedUser.email, updatedUser.name);

    await this.auditService.log({
      action: AuditAction.USER_DEACTIVATED,
      performedById: requestingUser.id,
      targetType: 'User',
      targetId: id,
      targetLabel: updatedUser.name,
    });

    return updatedUser;
  }

  async reactivateUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(ERR.users.notFound);

    if (user.status !== UserStatus.INACTIVE) {
      throw new BadRequestException(ERR.users.notInactive);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE, deactivatedAt: null },
      select: USER_SELECT,
    });

    await this.emailService.sendReactivationEmail(updatedUser.email, updatedUser.name);

    // Note: reactivateUser doesn't receive requestingUser currently, so we use the user's own ID
    // This should be updated when the controller passes the requesting user
    await this.auditService.log({
      action: AuditAction.USER_REACTIVATED,
      performedById: user.id,
      targetType: 'User',
      targetId: id,
      targetLabel: updatedUser.name,
    });

    return updatedUser;
  }

  async resendInvitation(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(ERR.users.notFound);

    if (user.status !== UserStatus.INVITED) {
      throw new BadRequestException(ERR.users.alreadyActivated);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const invitationToken = await argon2.hash(rawToken);
    const invitationTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id },
      data: { invitationToken, invitationTokenExpiresAt },
    });

    const appUrl = getAppUrlForRole(this.config, user.role);
    const activationUrl = `${appUrl}/activate?token=${rawToken}`;

    await this.emailService.sendInvitationEmail(user.email, activationUrl, user.name);

    return { message: 'Invitation resent successfully' };
  }

  async initiateResetPassword(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(ERR.users.notFound);

    if (user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException(ERR.users.onlyResetActiveUsers);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const passwordResetToken = await argon2.hash(rawToken);
    const passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.prisma.user.update({
      where: { id },
      data: { passwordResetToken, passwordResetExpiresAt },
    });

    const appUrl = getAppUrlForRole(this.config, user.role);
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    await this.emailService.sendPasswordResetEmail(user.email, resetUrl, user.name);

    return { message: 'Password reset email sent successfully' };
  }

  async cancelInvitation(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(ERR.users.notFound);

    if (user.status !== UserStatus.INVITED) {
      throw new BadRequestException(ERR.users.cannotCancelInvitation);
    }

    await this.prisma.$transaction(async (tx) => {
      // Disconnect from company and inviter before deletion to prevent any cascade side-effects
      await tx.user.update({
        where: { id },
        data: { companyId: null, invitedByUserId: null },
      });

      // Clean up related records explicitly
      await tx.emailVerification.deleteMany({ where: { userId: id } });

      await tx.user.delete({ where: { id } });
    });

    return { message: 'Invitation cancelled and user removed' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });

    if (!user) throw new NotFoundException(ERR.users.notFound);

    const granted = await this.permissionsService.getPermissionsForRole(user.role);
    return { ...user, permissions: Array.from(granted) };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: USER_SELECT,
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new BadRequestException(ERR.users.noPasswordSet);
    }

    const isValid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!isValid) throw new BadRequestException(ERR.users.currentPasswordIncorrect);

    const passwordHash = await argon2.hash(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, refreshTokenHash: null },
    });

    return { message: 'Password changed successfully. Please log in again.' };
  }
}
