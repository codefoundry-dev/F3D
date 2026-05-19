import * as crypto from 'crypto';

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { getAppUrlForRole } from '../../common/utils/app-url.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, AuditAction } from '../audit/audit.service';
import { EmailService } from '../notifications/email.service';

import { InviteVendorUserDto } from './vendors.dto';

@Injectable()
export class VendorUserInviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async inviteVendorUser(companyId: string, dto: InviteVendorUserDto, user: AuthenticatedUser) {
    // Validate the requesting user is a vendor and belongs to the same company
    if (user.role !== UserRole.VENDOR) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (user.companyId !== companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    // Check email not already in use
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException(ERR.vendors.userEmailInUse);
    }

    // Generate invitation token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const invitationToken = await argon2.hash(rawToken);
    const invitationTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create user with INVITED status
    const newUser = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        position: dto.position,
        role: UserRole.VENDOR,
        status: UserStatus.INVITED,
        companyId,
        invitedByUserId: user.id,
        invitationToken,
        invitationTokenExpiresAt,
      },
    });

    // Send invitation email
    const appUrl = getAppUrlForRole(this.config, UserRole.VENDOR);
    const activationUrl = `${appUrl}/activate?token=${rawToken}`;

    await this.emailService.sendVendorInvitationEmail(dto.email, activationUrl, dto.name);

    // Audit log
    await this.auditService.log({
      action: AuditAction.VENDOR_USER_INVITED,
      performedById: user.id,
      targetType: 'User',
      targetId: newUser.id,
      targetLabel: newUser.name,
      metadata: { companyId, email: dto.email },
    });

    return {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      position: newUser.position,
      status: newUser.status,
    };
  }

  async resendInvitation(companyId: string, userId: string, user: AuthenticatedUser) {
    // Validate same company
    if (user.role !== UserRole.VENDOR || user.companyId !== companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    const targetUser = await this.prisma.user.findFirst({
      where: { id: userId, companyId, status: UserStatus.INVITED },
    });

    if (!targetUser) {
      throw new NotFoundException(ERR.users.notFound);
    }

    // Regenerate token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const invitationToken = await argon2.hash(rawToken);
    const invitationTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: { invitationToken, invitationTokenExpiresAt },
    });

    // Resend email
    const appUrl = getAppUrlForRole(this.config, UserRole.VENDOR);
    const activationUrl = `${appUrl}/activate?token=${rawToken}`;

    await this.emailService.sendVendorInvitationEmail(
      targetUser.email,
      activationUrl,
      targetUser.name,
    );

    return { message: 'Invitation resent successfully' };
  }

  async cancelInvitation(companyId: string, userId: string, user: AuthenticatedUser) {
    // Validate same company
    if (user.role !== UserRole.VENDOR || user.companyId !== companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    const targetUser = await this.prisma.user.findFirst({
      where: { id: userId, companyId, status: UserStatus.INVITED },
    });

    if (!targetUser) {
      throw new NotFoundException(ERR.users.notFound);
    }

    await this.prisma.user.delete({ where: { id: userId } });

    return { message: 'Invitation cancelled successfully' };
  }
}
