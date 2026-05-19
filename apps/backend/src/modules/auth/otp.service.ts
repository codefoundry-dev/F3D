import { Injectable, BadRequestException, HttpException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';

import { ERR } from '../../common/constants/error-messages.const';
import { PrismaService } from '../../prisma/prisma.service';

const OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 3;

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

    await this.prisma.emailVerification.upsert({
      where: { userId },
      create: { userId, otpHash, expiresAt },
      update: { otpHash, expiresAt, attempts: 0 },
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

    if (record.expiresAt < new Date()) {
      await this.prisma.emailVerification.delete({ where: { userId } });
      throw new BadRequestException(ERR.auth.otpExpired);
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      await this.prisma.emailVerification.delete({ where: { userId } });
      throw new HttpException(ERR.auth.accountLocked, 423);
    }

    const isValid = await argon2.verify(record.otpHash, otp);

    if (!isValid) {
      const updated = await this.prisma.emailVerification.update({
        where: { userId },
        data: { attempts: { increment: 1 } },
      });

      if (updated.attempts >= MAX_OTP_ATTEMPTS) {
        throw new HttpException(ERR.auth.accountLocked, 423);
      }

      return false;
    }

    // Successful — clean up the record
    await this.prisma.emailVerification.delete({ where: { userId } });
    return true;
  }
}
