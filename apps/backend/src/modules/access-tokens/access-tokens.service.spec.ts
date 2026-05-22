import { createHash } from 'crypto';

import { ForbiddenException, HttpException } from '@nestjs/common';
import {
  AccessTokenPurpose,
  AccessTokenSubject,
  type AccessToken,
  type Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { AccessTokensService } from './access-tokens.service';

type MockedAccessTokenDelegate = {
  create: jest.Mock;
  findUnique: jest.Mock;
  findUniqueOrThrow: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  deleteMany: jest.Mock;
};

function makeRow(overrides: Partial<AccessToken> = {}): AccessToken {
  const now = new Date();
  return {
    id: 'tok-1',
    lookupId: 'lookup-1',
    tokenHash: createHash('sha256').update('secret-value').digest('hex'),
    subjectType: AccessTokenSubject.RFQ,
    subjectId: 'rfq-1',
    purpose: AccessTokenPurpose.RFQ_VIEW,
    expiresAt: new Date(now.getTime() + 60_000),
    usedAt: null,
    attempts: 0,
    maxAttempts: 10,
    lastAttemptIp: null,
    lastAttemptAt: null,
    revokedAt: null,
    createdByUserId: null,
    metadata: null as unknown as Prisma.JsonValue,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('AccessTokensService', () => {
  let service: AccessTokensService;
  let prisma: { accessToken: MockedAccessTokenDelegate };

  beforeEach(() => {
    prisma = {
      accessToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    service = new AccessTokensService(prisma as unknown as PrismaService);
  });

  describe('issueToken', () => {
    it('returns an opaque <lookupId>_<secret> token and persists a hashed secret', async () => {
      prisma.accessToken.create.mockImplementation(({ data }: { data: Prisma.AccessTokenCreateInput }) =>
        Promise.resolve(makeRow({
          lookupId: data.lookupId,
          tokenHash: data.tokenHash,
          subjectType: data.subjectType,
          subjectId: data.subjectId,
          purpose: data.purpose,
          expiresAt: data.expiresAt as Date,
        })),
      );

      const { token, record } = await service.issueToken({
        subjectType: AccessTokenSubject.RFQ,
        subjectId: 'rfq-1',
        purpose: AccessTokenPurpose.RFQ_VIEW,
        ttlMs: 60_000,
      });

      // Token has the wire-format separator and >= 128 bits of entropy
      // (lookupId ≥ 95 bits + secret 256 bits → ~351 bits combined).
      const parts = token.split('.');
      expect(parts).toHaveLength(2);
      const [lookupId, secret] = parts;
      expect(lookupId).toMatch(/^[A-Za-z0-9]{16}$/); // 16 base62 chars
      expect(secret.length).toBeGreaterThanOrEqual(43); // 32 bytes base64url

      // Only the SHA-256 of the secret is stored; the plaintext is never persisted.
      expect(record.tokenHash).toEqual(createHash('sha256').update(secret).digest('hex'));
      expect(record.tokenHash).not.toContain(secret);
    });

    it('respects custom maxAttempts and createdByUserId', async () => {
      prisma.accessToken.create.mockResolvedValue(makeRow({ maxAttempts: 3, createdByUserId: 'u-1' }));

      await service.issueToken({
        subjectType: AccessTokenSubject.QUOTE_RESPONSE,
        subjectId: 'q-1',
        purpose: AccessTokenPurpose.QUOTE_SUBMIT,
        ttlMs: 60_000,
        maxAttempts: 3,
        createdByUserId: 'u-1',
      });

      const call = prisma.accessToken.create.mock.calls[0][0] as {
        data: Prisma.AccessTokenUncheckedCreateInput;
      };
      expect(call.data.maxAttempts).toBe(3);
      expect(call.data.createdByUserId).toBe('u-1');
    });
  });

  describe('validateToken', () => {
    it('returns the row for a valid token and records the attempt', async () => {
      const secret = 'super-random-secret-value';
      const row = makeRow({ tokenHash: createHash('sha256').update(secret).digest('hex') });
      prisma.accessToken.findUnique.mockResolvedValue(row);
      prisma.accessToken.update.mockResolvedValue({ ...row, attempts: 1, lastAttemptIp: '1.2.3.4' });

      const result = await service.validateToken(`${row.lookupId}.${secret}`, { ip: '1.2.3.4' });

      expect(result.attempts).toBe(1);
      expect(prisma.accessToken.update).toHaveBeenCalledWith({
        where: { id: row.id },
        data: {
          attempts: { increment: 1 },
          lastAttemptAt: expect.any(Date),
          lastAttemptIp: '1.2.3.4',
        },
      });
    });

    it('throws 403 when the raw token is missing', async () => {
      await expect(service.validateToken('')).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when the raw token is malformed', async () => {
      await expect(service.validateToken('no-separator')).rejects.toThrow(/malformed/i);
      await expect(service.validateToken('.only-secret')).rejects.toThrow(/malformed/i);
      await expect(service.validateToken('only-lookup.')).rejects.toThrow(/malformed/i);
    });

    it('throws 403 for an unknown lookupId', async () => {
      prisma.accessToken.findUnique.mockResolvedValue(null);
      await expect(service.validateToken('unknown.secret')).rejects.toThrow(/invalid/i);
    });

    it('throws 403 for an expired token', async () => {
      const secret = 'good-secret';
      const row = makeRow({
        expiresAt: new Date(Date.now() - 1000),
        tokenHash: createHash('sha256').update(secret).digest('hex'),
      });
      prisma.accessToken.findUnique.mockResolvedValue(row);
      prisma.accessToken.update.mockResolvedValue({ ...row, attempts: 1 });

      await expect(service.validateToken(`${row.lookupId}.${secret}`)).rejects.toThrow(/expired/i);
    });

    it('throws 403 for an already-consumed token', async () => {
      const secret = 'good-secret';
      const row = makeRow({
        usedAt: new Date(),
        tokenHash: createHash('sha256').update(secret).digest('hex'),
      });
      prisma.accessToken.findUnique.mockResolvedValue(row);
      prisma.accessToken.update.mockResolvedValue({ ...row, attempts: 1 });

      await expect(service.validateToken(`${row.lookupId}.${secret}`)).rejects.toThrow(/already been used/i);
    });

    it('throws 403 for a revoked token', async () => {
      const secret = 'good-secret';
      const row = makeRow({
        revokedAt: new Date(),
        tokenHash: createHash('sha256').update(secret).digest('hex'),
      });
      prisma.accessToken.findUnique.mockResolvedValue(row);
      prisma.accessToken.update.mockResolvedValue({ ...row, attempts: 1 });

      await expect(service.validateToken(`${row.lookupId}.${secret}`)).rejects.toThrow(/revoked/i);
    });

    it('throws 403 when the secret does not match the stored hash', async () => {
      const row = makeRow({ tokenHash: createHash('sha256').update('correct-secret').digest('hex') });
      prisma.accessToken.findUnique.mockResolvedValue(row);
      prisma.accessToken.update.mockResolvedValue({ ...row, attempts: 1 });

      await expect(service.validateToken(`${row.lookupId}.wrong-secret`)).rejects.toThrow(/invalid/i);
    });

    it('throws 403 when the purpose does not match expectedPurpose', async () => {
      const secret = 'good-secret';
      const row = makeRow({
        purpose: AccessTokenPurpose.RFQ_VIEW,
        tokenHash: createHash('sha256').update(secret).digest('hex'),
      });
      prisma.accessToken.findUnique.mockResolvedValue(row);
      prisma.accessToken.update.mockResolvedValue({ ...row, attempts: 1 });

      await expect(
        service.validateToken(`${row.lookupId}.${secret}`, {
          expectedPurpose: AccessTokenPurpose.QUOTE_SUBMIT,
        }),
      ).rejects.toThrow(/not valid for this action/i);
    });

    it('locks the token with 429 once attempts exceed maxAttempts', async () => {
      const secret = 'good-secret';
      const row = makeRow({
        attempts: 9,
        maxAttempts: 10,
        tokenHash: createHash('sha256').update(secret).digest('hex'),
      });
      prisma.accessToken.findUnique.mockResolvedValue(row);
      // Simulate the increment putting attempts above maxAttempts.
      prisma.accessToken.update.mockResolvedValue({ ...row, attempts: 11 });

      await expect(service.validateToken(`${row.lookupId}.${secret}`)).rejects.toThrow(HttpException);
      await expect(service.validateToken(`${row.lookupId}.${secret}`)).rejects.toThrow(/too many attempts/i);
    });

    it('bumps attempts even when the secret is wrong (brute-force protection)', async () => {
      const row = makeRow({ tokenHash: createHash('sha256').update('correct').digest('hex') });
      prisma.accessToken.findUnique.mockResolvedValue(row);
      prisma.accessToken.update.mockResolvedValue({ ...row, attempts: 1 });

      await expect(service.validateToken(`${row.lookupId}.wrong`)).rejects.toThrow();
      expect(prisma.accessToken.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('consumeToken', () => {
    it('marks the token as used and returns the fresh row', async () => {
      prisma.accessToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.accessToken.findUniqueOrThrow.mockResolvedValue(
        makeRow({ usedAt: new Date('2026-05-22T01:00:00Z') }),
      );

      const result = await service.consumeToken('tok-1');

      expect(prisma.accessToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'tok-1', usedAt: null, revokedAt: null },
        data: { usedAt: expect.any(Date) },
      });
      expect(result.usedAt).toBeInstanceOf(Date);
    });

    it('throws ForbiddenException when the token was already consumed', async () => {
      prisma.accessToken.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.consumeToken('tok-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('revokeToken', () => {
    it('sets revokedAt and is idempotent', async () => {
      prisma.accessToken.updateMany.mockResolvedValue({ count: 1 });
      await service.revokeToken('tok-1');
      expect(prisma.accessToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'tok-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('pruneExpired', () => {
    it('deletes tokens whose expiry is older than the grace window', async () => {
      prisma.accessToken.deleteMany.mockResolvedValue({ count: 3 });
      const count = await service.pruneExpired(1000);
      expect(count).toBe(3);
      expect(prisma.accessToken.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });
  });
});
