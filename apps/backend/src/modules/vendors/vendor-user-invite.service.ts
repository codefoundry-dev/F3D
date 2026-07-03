import * as crypto from 'crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { getAppUrlForRole } from '../../common/utils/app-url.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, AuditAction } from '../audit/audit.service';
import { EmailService } from '../notifications/email.service';

import { assertVendorAccess } from './vendor-access.util';
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
    // Rep-lifecycle authority is relational (ADR-0016): the vendor itself or
    // any assigned contractor may invite.
    await assertVendorAccess(this.prisma, companyId, user);

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

  /**
   * Sends (or re-sends) the activation invitation to an existing INVITED rep.
   * For a contact-only rep (no token — FOR-272 "add without invite") this is
   * the *first* invite, so it is audited as VENDOR_USER_INVITED; a re-send of
   * an already-pending invitation is not.
   */
  async resendInvitation(companyId: string, userId: string, user: AuthenticatedUser) {
    await assertVendorAccess(this.prisma, companyId, user);

    // Only INVITED reps can receive an invitation: ACTIVE reps already have
    // credentials, and INACTIVE (deactivated) reps must never receive
    // vendor-bound emails.
    const targetUser = await this.prisma.user.findFirst({
      where: { id: userId, companyId, status: UserStatus.INVITED },
    });

    if (!targetUser) {
      throw new NotFoundException(ERR.users.notFound);
    }

    const isFirstInvite = targetUser.invitationToken == null;

    // Mint (or regenerate) the token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const invitationToken = await argon2.hash(rawToken);
    const invitationTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: { invitationToken, invitationTokenExpiresAt },
    });

    // Send email
    const appUrl = getAppUrlForRole(this.config, UserRole.VENDOR);
    const activationUrl = `${appUrl}/activate?token=${rawToken}`;

    await this.emailService.sendVendorInvitationEmail(
      targetUser.email,
      activationUrl,
      targetUser.name,
    );

    if (isFirstInvite) {
      await this.auditService.log({
        action: AuditAction.VENDOR_USER_INVITED,
        performedById: user.id,
        targetType: 'User',
        targetId: targetUser.id,
        targetLabel: targetUser.name,
        metadata: { companyId, email: targetUser.email },
      });
    }

    return { message: 'Invitation resent successfully' };
  }

  /**
   * Revokes a pending invitation. The rep reverts to contact-only — still
   * INVITED, still selectable on RFQs. This deliberately does NOT delete the
   * user row (it used to): destruction is the separate remove-representative
   * action, guarded against RFQ contact references.
   */
  async cancelInvitation(companyId: string, userId: string, user: AuthenticatedUser) {
    await assertVendorAccess(this.prisma, companyId, user);

    const targetUser = await this.prisma.user.findFirst({
      where: { id: userId, companyId, status: UserStatus.INVITED },
    });

    if (!targetUser) {
      throw new NotFoundException(ERR.users.notFound);
    }

    if (targetUser.invitationToken == null) {
      throw new NotFoundException(ERR.vendors.noPendingInvitation);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { invitationToken: null, invitationTokenExpiresAt: null },
    });

    return { message: 'Invitation cancelled successfully' };
  }
}
