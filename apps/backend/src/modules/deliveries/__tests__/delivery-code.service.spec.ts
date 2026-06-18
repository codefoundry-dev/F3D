import { BadRequestException, HttpException } from '@nestjs/common';
import * as argon2 from 'argon2';

import { PrismaService } from '../../../prisma/prisma.service';
import { DeliveryCodeService } from '../delivery-code.service';

function makePrisma() {
  return {
    deliveryAccessCode: {
      findUnique: jest.fn(),
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({ attempts: 1 }),
      delete: jest.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaService & {
    deliveryAccessCode: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
}

const PO = 'po-1';
const EMAIL = 'driver@example.com';

describe('DeliveryCodeService', () => {
  // ── generateAndStore ───────────────────────────────────────────────────────────
  describe('generateAndStore', () => {
    it('returns a 6-digit code and upserts a hashed entry with reset attempts', async () => {
      const prisma = makePrisma();
      prisma.deliveryAccessCode.findUnique.mockResolvedValue(null);
      const service = new DeliveryCodeService(prisma);

      const { code, expiresAt } = await service.generateAndStore(PO, EMAIL);

      expect(code).toMatch(/^\d{6}$/);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
      const upsertArg = prisma.deliveryAccessCode.upsert.mock.calls[0][0];
      expect(upsertArg.where.purchaseOrderId_email).toEqual({ purchaseOrderId: PO, email: EMAIL });
      expect(upsertArg.update.attempts).toBe(0);
      // The stored code is hashed, never the plaintext.
      expect(JSON.stringify(upsertArg.create.codes)).not.toContain(code);
    });

    it('keeps earlier unexpired codes (newest first) and caps at 3', async () => {
      const prisma = makePrisma();
      const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      prisma.deliveryAccessCode.findUnique.mockResolvedValue({
        codes: [
          { hash: 'h1', expiresAt: future },
          { hash: 'h2', expiresAt: future },
          { hash: 'h3', expiresAt: future },
        ],
      });
      const service = new DeliveryCodeService(prisma);

      await service.generateAndStore(PO, EMAIL);

      const codes = prisma.deliveryAccessCode.upsert.mock.calls[0][0].create.codes as unknown[];
      expect(codes).toHaveLength(3); // new + 2 kept, capped
    });

    it('drops already-expired earlier codes', async () => {
      const prisma = makePrisma();
      const past = new Date(Date.now() - 60 * 1000).toISOString();
      prisma.deliveryAccessCode.findUnique.mockResolvedValue({
        codes: [{ hash: 'old', expiresAt: past }],
      });
      const service = new DeliveryCodeService(prisma);

      await service.generateAndStore(PO, EMAIL);

      const codes = prisma.deliveryAccessCode.upsert.mock.calls[0][0].create.codes as unknown[];
      expect(codes).toHaveLength(1); // only the new code
    });
  });

  // ── verifyCode ─────────────────────────────────────────────────────────────────
  describe('verifyCode', () => {
    it('throws when there is no code slot', async () => {
      const prisma = makePrisma();
      prisma.deliveryAccessCode.findUnique.mockResolvedValue(null);
      const service = new DeliveryCodeService(prisma);
      await expect(service.verifyCode(PO, EMAIL, '123456')).rejects.toThrow(BadRequestException);
    });

    it('throws and clears the slot when all codes have expired', async () => {
      const prisma = makePrisma();
      prisma.deliveryAccessCode.findUnique.mockResolvedValue({
        attempts: 0,
        codes: [{ hash: 'h', expiresAt: new Date(Date.now() - 1000).toISOString() }],
      });
      const service = new DeliveryCodeService(prisma);
      await expect(service.verifyCode(PO, EMAIL, '123456')).rejects.toThrow(BadRequestException);
      expect(prisma.deliveryAccessCode.delete).toHaveBeenCalled();
    });

    it('throws 423 and clears the slot when attempts are exhausted', async () => {
      const prisma = makePrisma();
      prisma.deliveryAccessCode.findUnique.mockResolvedValue({
        attempts: 3,
        codes: [{ hash: 'h', expiresAt: new Date(Date.now() + 60000).toISOString() }],
      });
      const service = new DeliveryCodeService(prisma);
      await expect(service.verifyCode(PO, EMAIL, '123456')).rejects.toThrow(HttpException);
      expect(prisma.deliveryAccessCode.delete).toHaveBeenCalled();
    });

    it('returns true and clears the slot on a matching code', async () => {
      const prisma = makePrisma();
      const hash = await argon2.hash('654321');
      prisma.deliveryAccessCode.findUnique.mockResolvedValue({
        attempts: 0,
        codes: [{ hash, expiresAt: new Date(Date.now() + 60000).toISOString() }],
      });
      const service = new DeliveryCodeService(prisma);

      await expect(service.verifyCode(PO, EMAIL, '654321')).resolves.toBe(true);
      expect(prisma.deliveryAccessCode.delete).toHaveBeenCalled();
    });

    it('returns false and counts the attempt on a non-match', async () => {
      const prisma = makePrisma();
      const hash = await argon2.hash('111111');
      prisma.deliveryAccessCode.findUnique.mockResolvedValue({
        attempts: 0,
        codes: [{ hash, expiresAt: new Date(Date.now() + 60000).toISOString() }],
      });
      prisma.deliveryAccessCode.update.mockResolvedValue({ attempts: 1 });
      const service = new DeliveryCodeService(prisma);

      await expect(service.verifyCode(PO, EMAIL, '999999')).resolves.toBe(false);
      expect(prisma.deliveryAccessCode.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ attempts: { increment: 1 } }) }),
      );
    });

    it('throws 423 when the failed attempt reaches the limit', async () => {
      const prisma = makePrisma();
      const hash = await argon2.hash('222222');
      prisma.deliveryAccessCode.findUnique.mockResolvedValue({
        attempts: 2,
        codes: [{ hash, expiresAt: new Date(Date.now() + 60000).toISOString() }],
      });
      prisma.deliveryAccessCode.update.mockResolvedValue({ attempts: 3 });
      const service = new DeliveryCodeService(prisma);

      await expect(service.verifyCode(PO, EMAIL, '000000')).rejects.toThrow(HttpException);
    });

    it('round-trips a freshly generated code', async () => {
      // generateAndStore stores a real argon2 hash; feed it back into verify.
      const prisma = makePrisma();
      prisma.deliveryAccessCode.findUnique.mockResolvedValueOnce(null);
      const service = new DeliveryCodeService(prisma);
      const { code } = await service.generateAndStore(PO, EMAIL);
      const stored = prisma.deliveryAccessCode.upsert.mock.calls[0][0].create.codes;
      prisma.deliveryAccessCode.findUnique.mockResolvedValueOnce({ attempts: 0, codes: stored });

      await expect(service.verifyCode(PO, EMAIL, code)).resolves.toBe(true);
    });
  });
});
