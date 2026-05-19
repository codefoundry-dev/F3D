import * as crypto from 'crypto';

import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyType, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

import { ERR } from '../../common/constants/error-messages.const';
import { getAppUrlForRole } from '../../common/utils/app-url.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, AuditAction } from '../audit/audit.service';
import { EmailService } from '../notifications/email.service';

import { InviteVendorDto, AuthUser } from './vendors.dto';

@Injectable()
export class VendorInviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async inviteVendor(dto: InviteVendorDto, requestingUser: AuthUser) {
    if (!requestingUser.companyId) {
      throw new BadRequestException(ERR.companies.contractorNotFound);
    }

    // Check if vendor company already exists by contactEmail
    const existingCompany = await this.prisma.company.findFirst({
      where: {
        contactEmail: dto.companyEmail,
        type: CompanyType.VENDOR,
      },
      include: {
        users: {
          where: { role: UserRole.VENDOR },
          select: { id: true, status: true, name: true },
          take: 1,
        },
      },
    });

    if (existingCompany) {
      // Check if already assigned to this contractor
      const existingAssignment = await this.prisma.companyVendorAssignment.findUnique({
        where: {
          vendorId_contractorId: {
            vendorId: existingCompany.id,
            contractorId: requestingUser.companyId,
          },
        },
      });

      if (!existingAssignment) {
        // Vendor exists on platform but not in this contractor's list — add directly
        await this.prisma.companyVendorAssignment.create({
          data: {
            vendorId: existingCompany.id,
            contractorId: requestingUser.companyId,
          },
        });
      }

      // Check if userEmail already exists before creating a new user
      const existingUserForInvite = await this.prisma.user.findUnique({
        where: { email: dto.userEmail },
      });
      if (existingUserForInvite) {
        throw new ConflictException(ERR.vendors.userEmailInUse);
      }

      // Create a new user (representative) for the existing vendor company
      const rawToken = crypto.randomBytes(32).toString('hex');
      const invitationToken = await argon2.hash(rawToken);
      const invitationTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await this.prisma.user.create({
        data: {
          name: dto.userName,
          email: dto.userEmail,
          role: UserRole.VENDOR,
          companyId: existingCompany.id,
          status: UserStatus.INVITED,
          invitedByUserId: requestingUser.id,
          invitationToken,
          invitationTokenExpiresAt,
        },
      });

      // Send invitation email
      const appUrl = getAppUrlForRole(this.config, UserRole.VENDOR);
      const activationUrl = `${appUrl}/activate?token=${rawToken}`;
      await this.emailService.sendVendorInvitationEmail(dto.userEmail, activationUrl, dto.userName);

      await this.auditService.log({
        action: AuditAction.VENDOR_INVITED,
        performedById: requestingUser.id,
        targetType: 'Company',
        targetId: existingCompany.id,
        targetLabel: existingCompany.legalName,
        metadata: { alreadyExisted: true, newUser: dto.userEmail },
      });

      return {
        message: 'Vendor already exists on the platform and has been added to your vendor list.',
        vendorCompanyId: existingCompany.id,
        alreadyExisted: true,
      };
    }

    // Check if userEmail already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.userEmail },
    });
    if (existingUser) {
      throw new ConflictException(ERR.vendors.userEmailInUse);
    }

    // Create new vendor company + user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create vendor company
      const vendorCompany = await tx.company.create({
        data: {
          type: CompanyType.VENDOR,
          legalName: dto.companyName,
          contactEmail: dto.companyEmail,
          status: 'ACTIVE',
        },
      });

      // Generate invitation token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const invitationToken = await argon2.hash(rawToken);
      const invitationTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Create vendor user
      const vendorUser = await tx.user.create({
        data: {
          name: dto.userName,
          email: dto.userEmail,
          role: UserRole.VENDOR,
          companyId: vendorCompany.id,
          status: UserStatus.INVITED,
          invitedByUserId: requestingUser.id,
          invitationToken,
          invitationTokenExpiresAt,
        },
      });

      // Assign vendor to contractor
      await tx.companyVendorAssignment.create({
        data: {
          vendorId: vendorCompany.id,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guarded by check at method start
          contractorId: requestingUser.companyId!,
        },
      });

      return { vendorCompany, vendorUser, rawToken };
    });

    // Send invitation emails (outside transaction)
    const appUrl = getAppUrlForRole(this.config, UserRole.VENDOR);
    const activationUrl = `${appUrl}/activate?token=${result.rawToken}`;

    // Send to user email (with activation link)
    await this.emailService.sendVendorInvitationEmail(dto.userEmail, activationUrl, dto.userName);

    // Send to company email (notification only, if different from user email)
    if (dto.companyEmail !== dto.userEmail) {
      await this.emailService.sendVendorCompanyInvitationEmail(dto.companyEmail);
    }

    await this.auditService.log({
      action: AuditAction.VENDOR_INVITED,
      performedById: requestingUser.id,
      targetType: 'Company',
      targetId: result.vendorCompany.id,
      targetLabel: result.vendorCompany.legalName,
      metadata: { alreadyExisted: false },
    });

    return {
      message: 'Vendor invitation has been sent successfully.',
      vendorCompanyId: result.vendorCompany.id,
      alreadyExisted: false,
    };
  }
}
