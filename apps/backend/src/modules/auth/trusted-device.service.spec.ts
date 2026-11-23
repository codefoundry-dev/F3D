import * as crypto from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';

import { TRUSTED_DEVICE_TTL_MS, TrustedDeviceService } from './trusted-device.service';

const sha256 = (v: string): string => crypto.createHash('sha256').update(v).digest('hex');

describe('TrustedDeviceService', () => {
  let service: TrustedDeviceService;
  let prisma: {
    trustedDevice: { create: jest.Mock; updateMany: jest.Mock; deleteMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      trustedDevice: {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    service = new TrustedDeviceService(prisma as unknown as PrismaService);
  });

  describe('trust', () => {
    it('stores only the hash of the token it hands to the browser', async () => {
      const token = await service.trust('user-1', 'Mozilla/5.0');

      expect(token.length).toBeGreaterThanOrEqual(43); // 256 bits, base64url
      const { data } = prisma.trustedDevice.create.mock.calls[0][0];
      expect(data.tokenHash).toBe(sha256(token));
      expect(data.tokenHash).not.toContain(token);
      expect(data).toMatchObject({ userId: 'user-1', userAgent: 'Mozilla/5.0' });
      const ttl = (data.expiresAt as Date).getTime() - Date.now();
      expect(ttl).toBeGreaterThan(TRUSTED_DEVICE_TTL_MS - 5000);
      expect(ttl).toBeLessThanOrEqual(TRUSTED_DEVICE_TTL_MS);
    });

    it('issues a different token every time', async () => {
      expect(await service.trust('user-1')).not.toBe(await service.trust('user-1'));
    });

    it('truncates an oversized user agent instead of failing the sign-in', async () => {
      await service.trust('user-1', 'x'.repeat(900));
      expect(prisma.trustedDevice.create.mock.calls[0][0].data.userAgent).toHaveLength(500);
    });
  });

  describe('isTrusted', () => {
    it('is false without a token, and never queries', async () => {
      expect(await service.isTrusted('user-1', undefined)).toBe(false);
      expect(await service.isTrusted('user-1', '')).toBe(false);
      expect(prisma.trustedDevice.updateMany).not.toHaveBeenCalled();
    });

    it('matches on this user, the token hash and a live expiry, and does NOT extend the expiry', async () => {
      prisma.trustedDevice.updateMany.mockResolvedValue({ count: 1 });

      expect(await service.isTrusted('user-1', 'browser-token')).toBe(true);

      const { where, data } = prisma.trustedDevice.updateMany.mock.calls[0][0];
      expect(where).toEqual({
        userId: 'user-1',
        tokenHash: sha256('browser-token'),
        expiresAt: { gt: expect.any(Date) },
      });
      // Trust runs out 30 days after the code was entered, however often the
      // browser signs in meanwhile.
      expect(data).toEqual({ lastUsedAt: expect.any(Date) });
    });

    it('is false when nothing matches (unknown, expired, or another user)', async () => {
      prisma.trustedDevice.updateMany.mockResolvedValue({ count: 0 });
      expect(await service.isTrusted('user-2', 'browser-token')).toBe(false);
    });
  });

  it('revoke forgets only this browser for this user', async () => {
    await service.revoke('user-1', 'browser-token');
    expect(prisma.trustedDevice.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', tokenHash: sha256('browser-token') },
    });
  });

  it('revokeAll forgets every trusted browser for the user', async () => {
    await service.revokeAll('user-1');
    expect(prisma.trustedDevice.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });
});
