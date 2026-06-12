import { Injectable, BadRequestException, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';

import { ERR } from '../../common/constants/error-messages.const';
import { PrismaService } from '../../prisma/prisma.service';

const OTP_TTL_MINUTES = 15;
const MAX_OTP_ATTEMPTS = 3;
/**
 * How many of the most-recent OTPs stay valid for a user at the same time.
 * Lets someone act on an earlier email after re-requesting a code (e.g. slow
 * delivery) without their correct code being rejected as "invalid".
 */
const MAX_ACTIVE_CODES = 3;

/** One stored OTP: an argon2 hash plus its own absolute expiry (ISO 8601). */
interface StoredCode {
  hash: string;
  expiresAt: string;
}

@Injectable()
export class OtpService {
  constructor(private readonly prisma: PrismaService) {}

  async generateAndStore(userId: string): Promise<{ otp: string; expiresAt: Date }> {
    // Generate a 6-digit numeric OTP
    authenticator.options = { digits: 6 };
    const secret = authenticator.generateSecret();
    const otp = authenticator.generate(secret);

    const otpHash = await argon2.hash(otp);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    const newCode: StoredCode = { hash: otpHash, expiresAt: expiresAt.toISOString() };

    // Keep the new code plus any still-unexpired earlier ones (newest first, capped).
    const existing = await this.prisma.emailVerification.findUnique({ where: { userId } });
    const codes = [newCode, ...this.unexpired(this.parseCodes(existing?.codes))].slice(
      0,
      MAX_ACTIVE_CODES,
    );

    await this.prisma.emailVerification.upsert({
      where: { userId },
      create: { userId, codes: codes as unknown as Prisma.InputJsonValue },
      update: { codes: codes as unknown as Prisma.InputJsonValue, attempts: 0 },
    });

    return { otp, expiresAt };
  }

  async verifyOtp(userId: string, otp: string): Promise<boolean> {
    const record = await this.prisma.emailVerification.findUnique({
      where: { userId },
    });

    if (!record) {
      throw new BadRequestException(ERR.auth.otpNotFound);
    }

    const validCodes = this.unexpired(this.parseCodes(record.codes));

    if (validCodes.length === 0) {
      await this.prisma.emailVerification.delete({ where: { userId } });
      throw new BadRequestException(ERR.auth.otpExpired);
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      await this.prisma.emailVerification.delete({ where: { userId } });
      throw new HttpException(ERR.auth.accountLocked, 423);
    }

    // Accept the code if it matches ANY currently-valid OTP, not just the latest.
    for (const code of validCodes) {
      if (await argon2.verify(code.hash, otp)) {
        await this.prisma.emailVerification.delete({ where: { userId } });
        return true;
      }
    }

    // No match — count the attempt and drop any now-expired codes while we're here.
    const updated = await this.prisma.emailVerification.update({
      where: { userId },
      data: {
        codes: validCodes as unknown as Prisma.InputJsonValue,
        attempts: { increment: 1 },
      },
    });

    if (updated.attempts >= MAX_OTP_ATTEMPTS) {
      throw new HttpException(ERR.auth.accountLocked, 423);
    }

    return false;
  }

  /** Defensively read the JSON column into well-formed StoredCode entries. */
  private parseCodes(value: unknown): StoredCode[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (c): c is StoredCode =>
        !!c &&
        typeof c === 'object' &&
        typeof (c as Partial<StoredCode>).hash === 'string' &&
        typeof (c as Partial<StoredCode>).expiresAt === 'string',
    );
  }

  private unexpired(codes: StoredCode[]): StoredCode[] {
    const now = Date.now();
    return codes.filter((c) => new Date(c.expiresAt).getTime() > now);
  }
}
