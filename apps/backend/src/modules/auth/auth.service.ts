import * as crypto from 'crypto';

import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

import { ERR } from '../../common/constants/error-messages.const';
import { getAppUrlForRole } from '../../common/utils/app-url.util';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';

import { OtpService } from './otp.service';
import type { JwtPayload } from './strategies/jwt.strategy';
import { TrustedDeviceService } from './trusted-device.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Outcome of the password step. A new browser gets a sign-in code by email
 * (`otpRequired: true`); a trusted browser is signed in straight away.
 */
export type LoginResult =
  | { otpRequired: true; userId: string; otpExpiresAt: Date }
  | { otpRequired: false; userId: string; tokens: TokenPair };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly trustedDevices: TrustedDeviceService,
  ) {}

  /** Resolve the frontend URL for a given user role */
  getAppUrlForRole(role: string): string {
    return getAppUrlForRole(this.config, role);
  }

  /**
   * Step 1 of sign-in: check the password. If the browser presents a live
   * trusted-browser token for this user the emailed code is skipped and the
   * session is issued here; otherwise a code is emailed and step 2 (verifyOtp)
   * completes the sign-in.
   */
  async login(
    email: string,
    password: string,
    trustedDeviceToken?: string | null,
  ): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException(ERR.auth.invalidCredentials);
    }

    if (user.status === UserStatus.INVITED) {
      throw new ForbiddenException(ERR.auth.accountNotActivated);
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(ERR.auth.invalidCredentials);
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(ERR.auth.invalidCredentials);
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);

    if (!isPasswordValid) {
      throw new UnauthorizedException(ERR.auth.invalidCredentials);
    }

    if (await this.trustedDevices.isTrusted(user.id, trustedDeviceToken)) {
      return { otpRequired: false, userId: user.id, tokens: await this.startSession(user) };
    }

    const { otp, expiresAt } = await this.otpService.generateAndStore(user.id);

    await this.emailService.sendOtpEmail(user.email, otp, expiresAt);

    return { otpRequired: true, otpExpiresAt: expiresAt, userId: user.id };
  }

  /**
   * Re-issue an OTP for a login that's already past the password step (step 1.5).
   * Used by the "Resend code" action — the user only holds a userId at this point,
   * not their password, so this can't go through `login`. A valid userId is only
   * obtained after a successful password check, so this adds no enumeration risk.
   * Earlier still-valid codes are kept (see OtpService), so resending never
   * invalidates a code already in the user's inbox.
   */
  async resendOtp(userId: string): Promise<{ otpExpiresAt: Date; userId: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (user?.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(ERR.auth.invalidCredentials);
    }

    const { otp, expiresAt } = await this.otpService.generateAndStore(user.id);

    await this.emailService.sendOtpEmail(user.email, otp, expiresAt);

    return { otpExpiresAt: expiresAt, userId: user.id };
  }

  /**
   * Step 2 of sign-in on a new browser. With "Remember me" (the default) the
   * browser becomes trusted for 30 days: the returned `trustedDeviceToken` goes
   * into its cookie so sign-ins from it skip the code until then. Without it,
   * any trust the browser held is revoked and `trustedDeviceToken` is null.
   */
  async verifyOtp(
    userId: string,
    otp: string,
    options: {
      userAgent?: string | null;
      rememberDevice?: boolean;
      /** Token from the browser's existing trusted-device cookie, if any. */
      previousTrustedDeviceToken?: string | null;
    } = {},
  ): Promise<TokenPair & { trustedDeviceToken: string | null }> {
    const isValid = await this.otpService.verifyOtp(userId, otp);

    if (!isValid) {
      throw new UnauthorizedException(ERR.auth.invalidOtp);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, companyId: true },
    });

    if (!user) {
      throw new NotFoundException(ERR.users.notFound);
    }

    const tokens = await this.startSession(user);

    // A fresh code entry replaces whatever this browser held before, so the
    // stale row doesn't linger until its own expiry.
    if (options.previousTrustedDeviceToken) {
      await this.trustedDevices.revoke(user.id, options.previousTrustedDeviceToken);
    }
    const trustedDeviceToken =
      options.rememberDevice === false
        ? null
        : await this.trustedDevices.trust(user.id, options.userAgent);

    return { ...tokens, trustedDeviceToken };
  }

  /** Issue the access/refresh tokens for a completed sign-in and record it. */
  private async startSession(user: {
    id: string;
    email: string;
    role: string;
    companyId: string | null;
  }): Promise<TokenPair> {
    const tokens = await this.generateTokens(user);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: await argon2.hash(tokens.refreshToken),
        lastLoginAt: new Date(),
      },
    });

    return tokens;
  }

  async refresh(userId: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, companyId: true, status: true },
    });

    if (user?.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(ERR.auth.sessionExpired);
    }

    const tokens = await this.generateTokens(user);

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: await argon2.hash(tokens.refreshToken) },
    });

    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always succeed — no email enumeration
    if (user?.status !== UserStatus.ACTIVE) return;

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = await argon2.hash(resetToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes per FRD

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetTokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const appUrl = this.getAppUrlForRole(user.role);
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
    await this.emailService.sendPasswordResetEmail(user.email, resetUrl, user.name);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Find users with a non-null reset token that hasn't expired
    const users = await this.prisma.user.findMany({
      where: {
        passwordResetToken: { not: null },
        passwordResetExpiresAt: { gt: new Date() },
      },
    });

    let matchedUser: (typeof users)[0] | undefined;

    for (const user of users) {
      if (!user.passwordResetToken) continue;
      try {
        if (await argon2.verify(user.passwordResetToken, token)) {
          matchedUser = user;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!matchedUser) {
      throw new BadRequestException(ERR.auth.invalidResetToken);
    }

    const passwordHash = await argon2.hash(newPassword);

    await this.prisma.user.update({
      where: { id: matchedUser.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        refreshTokenHash: null, // Invalidate all sessions
      },
    });

    // A reset means the password may have been compromised: every browser has
    // to pass the sign-in code again.
    await this.trustedDevices.revokeAll(matchedUser.id);
  }

  async validateActivationToken(token: string): Promise<{ valid: boolean; email: string }> {
    const users = await this.prisma.user.findMany({
      where: {
        invitationToken: { not: null },
        status: UserStatus.INVITED,
      },
    });

    for (const user of users) {
      if (!user.invitationToken) continue;
      try {
        if (await argon2.verify(user.invitationToken, token)) {
          const valid =
            !!user.invitationTokenExpiresAt && user.invitationTokenExpiresAt > new Date();
          return { valid, email: user.email };
        }
      } catch {
        continue;
      }
    }

    throw new BadRequestException(ERR.auth.invalidInvitationToken);
  }

  async requestNewInvitation(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email, status: UserStatus.INVITED },
      include: { invitedBy: { select: { id: true, email: true, name: true } } },
    });

    // Always succeed — no email enumeration
    if (!user) return;

    const admin =
      user.invitedBy ??
      (await this.prisma.user.findFirst({
        where: {
          role: { in: [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN] },
          status: UserStatus.ACTIVE,
          ...(user.companyId ? { companyId: user.companyId } : {}),
        },
        select: { id: true, email: true, name: true },
        orderBy: { role: 'asc' },
      }));

    if (!admin) return;

    await this.emailService.sendInvitationExpiredNotification(
      admin.email,
      admin.name,
      user.name,
      user.email,
    );
  }

  async activateAccount(token: string, password: string): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: {
        invitationToken: { not: null },
        invitationTokenExpiresAt: { gt: new Date() },
        status: UserStatus.INVITED,
      },
    });

    let matchedUser: (typeof users)[0] | undefined;

    for (const user of users) {
      if (!user.invitationToken) continue;
      try {
        if (await argon2.verify(user.invitationToken, token)) {
          matchedUser = user;
          break;
        }
      } catch {
        // Skip tokens that aren't valid argon2 hashes (e.g. seed data)
        continue;
      }
    }

    if (!matchedUser) {
      throw new BadRequestException(ERR.auth.invalidOrExpiredInvitationToken);
    }

    const passwordHash = await argon2.hash(password);

    await this.prisma.user.update({
      where: { id: matchedUser.id },
      data: {
        passwordHash,
        status: UserStatus.ACTIVE,
        invitationToken: null,
        invitationTokenExpiresAt: null,
      },
    });

    // Confirm activation to the user (US 1.02). Fire-and-forget, like every
    // other transactional email — the account is already active by now, so a
    // mail failure must not fail the request the user is waiting on.
    const loginUrl = `${this.config.get<string>('WEB_APP_URL', 'http://localhost:5179')}/login`;
    try {
      await this.emailService.sendAccountActivatedEmail(
        matchedUser.email,
        matchedUser.name,
        loginUrl,
      );
    } catch {
      // fire-and-forget: activation has already succeeded
    }
  }

  private async generateTokens(user: {
    id: string;
    email: string;
    role: string;
    companyId: string | null;
  }): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ) as JwtSignOptions['expiresIn'],
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
