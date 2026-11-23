import * as crypto from 'crypto';

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

/** How long a browser stays trusted after the sign-in code was entered on it. */
export const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

/**
 * Remembers browsers that have completed the emailed sign-in code, so the code
 * is only asked for on a new device or browser.
 *
 * The browser holds a random 256-bit token in an httpOnly cookie; only its
 * SHA-256 is stored. The token is the second factor on a trusted browser — it
 * proves this is a browser that already passed the code for *this* user — so a
 * correct password is still required every time.
 */
@Injectable()
export class TrustedDeviceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Trust a browser that just passed the sign-in code; returns its cookie token. */
  async trust(userId: string, userAgent?: string | null): Promise<string> {
    const token = crypto.randomBytes(32).toString('base64url');
    await this.prisma.trustedDevice.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        userAgent: userAgent ? userAgent.slice(0, 500) : null,
        expiresAt: new Date(Date.now() + TRUSTED_DEVICE_TTL_MS),
      },
    });
    return token;
  }

  /**
   * Whether `token` is a live trusted-browser token for this user. The expiry
   * is fixed when the code is entered and NOT extended by later sign-ins, so
   * the code is asked for again 30 days after it was last entered.
   */
  async isTrusted(userId: string, token: string | null | undefined): Promise<boolean> {
    if (!token) return false;
    const now = new Date();
    const { count } = await this.prisma.trustedDevice.updateMany({
      where: { userId, tokenHash: hashToken(token), expiresAt: { gt: now } },
      data: { lastUsedAt: now },
    });
    return count > 0;
  }

  /** Forget one browser for a user (its cookie token). */
  async revoke(userId: string, token: string): Promise<void> {
    await this.prisma.trustedDevice.deleteMany({ where: { userId, tokenHash: hashToken(token) } });
  }

  /** Forget every trusted browser for a user (e.g. after a password reset). */
  async revokeAll(userId: string): Promise<void> {
    await this.prisma.trustedDevice.deleteMany({ where: { userId } });
  }
}
