import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';

import { PrismaService } from '../../prisma/prisma.service';

const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 3;
/**
 * How many of the most-recent codes stay valid for a (PO, email) pair at the
 * same time. Lets the delivery person act on an earlier email after
 * re-requesting a code without their correct code being rejected as "invalid".
 */
const MAX_ACTIVE_CODES = 3;

/** One stored code: an argon2 hash plus its own absolute expiry (ISO 8601). */
interface StoredCode {
  hash: string;
  expiresAt: string;
}

/**
 * Access-code service for the public delivery portal (Epic 6). Mirrors
 * OtpService's argon2 / 15-min-TTL / ≤3-active-codes / lock-at-3-attempts
 * mechanics, but is keyed by `(purchaseOrderId, email)` via the
 * DeliveryAccessCode model instead of by a user id — a delivery person has no
 * account.
 */
@Injectable()
export class DeliveryCodeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a fresh 6-digit code for `(purchaseOrderId, email)`, store its
   * argon2 hash (keeping any still-unexpired earlier ones, newest-first, capped),
   * reset the attempt counter, and return the plaintext code + its expiry for
   * emailing.
   */
  async generateAndStore(
    purchaseOrderId: string,
    email: string,
  ): Promise<{ code: string; expiresAt: Date }> {
    authenticator.options = { digits: 6 };
    const secret = authenticator.generateSecret();
    const code = authenticator.generate(secret);

    const hash = await argon2.hash(code);
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
    const newCode: StoredCode = { hash, expiresAt: expiresAt.toISOString() };

    const existing = await this.prisma.deliveryAccessCode.findUnique({
      where: { purchaseOrderId_email: { purchaseOrderId, email } },
    });
    const codes = [newCode, ...this.unexpired(this.parseCodes(existing?.codes))].slice(
      0,
      MAX_ACTIVE_CODES,
    );

    await this.prisma.deliveryAccessCode.upsert({
      where: { purchaseOrderId_email: { purchaseOrderId, email } },
      create: { purchaseOrderId, email, codes: codes as unknown as Prisma.InputJsonValue },
      update: { codes: codes as unknown as Prisma.InputJsonValue, attempts: 0 },
    });

    return { code, expiresAt };
  }

  /**
   * Verify `code` for `(purchaseOrderId, email)`. Returns true on the first
   * matching unexpired code (and clears the slot), false on a non-match (and
   * counts the attempt). Throws 400 when there is nothing to verify / all codes
   * expired, and 423 once the attempt limit is reached.
   */
  async verifyCode(purchaseOrderId: string, email: string, code: string): Promise<boolean> {
    const record = await this.prisma.deliveryAccessCode.findUnique({
      where: { purchaseOrderId_email: { purchaseOrderId, email } },
    });

    if (!record) {
      throw new BadRequestException('No delivery access code found. Request a new code.');
    }

    const validCodes = this.unexpired(this.parseCodes(record.codes));

    if (validCodes.length === 0) {
      await this.prisma.deliveryAccessCode.delete({
        where: { purchaseOrderId_email: { purchaseOrderId, email } },
      });
      throw new BadRequestException('Delivery access code has expired. Request a new code.');
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await this.prisma.deliveryAccessCode.delete({
        where: { purchaseOrderId_email: { purchaseOrderId, email } },
      });
      throw new HttpException('Too many incorrect attempts. Request a new code.', 423);
    }

    for (const stored of validCodes) {
      if (await argon2.verify(stored.hash, code)) {
        await this.prisma.deliveryAccessCode.delete({
          where: { purchaseOrderId_email: { purchaseOrderId, email } },
        });
        return true;
      }
    }

    // No match — count the attempt and drop any now-expired codes while here.
    const updated = await this.prisma.deliveryAccessCode.update({
      where: { purchaseOrderId_email: { purchaseOrderId, email } },
      data: {
        codes: validCodes as unknown as Prisma.InputJsonValue,
        attempts: { increment: 1 },
      },
    });

    if (updated.attempts >= MAX_ATTEMPTS) {
      throw new HttpException('Too many incorrect attempts. Request a new code.', 423);
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
