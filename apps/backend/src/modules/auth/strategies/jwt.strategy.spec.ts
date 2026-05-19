import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus, UserRole } from '@prisma/client';

import { JWT_COOKIE_NAMES } from '../../../common/utils/set-auth-cookies.util';
import { PrismaService } from '../../../prisma/prisma.service';

import { JwtStrategy, JwtPayload } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: { user: { findUnique: jest.Mock } };
  let configService: ConfigService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    configService = {
      get: jest.fn().mockReturnValue('test-jwt-access-secret'),
    } as unknown as ConfigService;

    strategy = new JwtStrategy(configService, prisma as unknown as PrismaService);
  });

  describe('JWT extraction from request', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let extractor: (req: any) => string | null;

    beforeEach(() => {
      // Access the internal passport extractor via the strategy instance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extractor = (strategy as any)._jwtFromRequest;
    });

    it('extracts token from access cookie when present', () => {
      const req = { cookies: { [JWT_COOKIE_NAMES.ACCESS]: 'cookie-jwt' }, headers: {} };
      expect(extractor(req)).toBe('cookie-jwt');
    });

    it('returns null when no cookie and no header', () => {
      const req = { cookies: {}, headers: {} };
      expect(extractor(req)).toBeNull();
    });

    it('returns null when cookies object is undefined', () => {
      const req = { headers: {} };
      expect(extractor(req)).toBeNull();
    });

    it('falls back to Authorization bearer header', () => {
      const req = { cookies: {}, headers: { authorization: 'Bearer header-token' } };
      expect(extractor(req)).toBe('header-token');
    });

    it('prefers cookie over header', () => {
      const req = {
        cookies: { [JWT_COOKIE_NAMES.ACCESS]: 'cookie-jwt' },
        headers: { authorization: 'Bearer header-token' },
      };
      expect(extractor(req)).toBe('cookie-jwt');
    });
  });

  describe('validate', () => {
    const payload: JwtPayload = {
      sub: 'user-1',
      email: 'user@example.com',
      role: UserRole.PROCUREMENT_OFFICER,
      companyId: 'company-1',
    };

    it('should return user object for an active user', async () => {
      const activeUser = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        role: UserRole.PROCUREMENT_OFFICER,
        status: UserStatus.ACTIVE,
        companyId: 'company-1',
      };
      prisma.user.findUnique.mockResolvedValue(activeUser);

      const result = await strategy.validate(payload);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          companyId: true,
        },
      });
      expect(result).toEqual(activeUser);
    });

    it('should throw UnauthorizedException for an inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        role: UserRole.PROCUREMENT_OFFICER,
        status: UserStatus.INACTIVE,
        companyId: 'company-1',
      });

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(payload)).rejects.toThrow('User account is not active');
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for an invited user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        role: UserRole.PROCUREMENT_OFFICER,
        status: UserStatus.INVITED,
        companyId: 'company-1',
      });

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });
  });
});
