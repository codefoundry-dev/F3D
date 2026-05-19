import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { Request } from 'express';

import { JWT_COOKIE_NAMES } from '../../../common/utils/set-auth-cookies.util';
import { PrismaService } from '../../../prisma/prisma.service';

import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import type { JwtPayload } from './jwt.strategy';

jest.mock('argon2');

const mockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

describe('JwtRefreshStrategy', () => {
  let strategy: JwtRefreshStrategy;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    const configService = {
      get: jest.fn().mockReturnValue('test-jwt-refresh-secret'),
    } as unknown as ConfigService;

    strategy = new JwtRefreshStrategy(configService, prisma as unknown as PrismaService);

    jest.clearAllMocks();
  });

  describe('JWT refresh extraction from request', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let extractor: (req: any) => string | null;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extractor = (strategy as any)._jwtFromRequest;
    });

    it('extracts refresh token from cookie', () => {
      const req = { cookies: { [JWT_COOKIE_NAMES.REFRESH]: 'refresh-jwt' }, headers: {}, body: {} };
      expect(extractor(req)).toBe('refresh-jwt');
    });

    it('returns null when no cookie and no body token', () => {
      const req = { cookies: {}, headers: {}, body: {} };
      expect(extractor(req)).toBeNull();
    });

    it('returns null when cookies undefined', () => {
      const req = { headers: {}, body: {} };
      expect(extractor(req)).toBeNull();
    });

    it('falls back to body refreshToken field', () => {
      const req = { cookies: {}, headers: {}, body: { refreshToken: 'body-token' } };
      expect(extractor(req)).toBe('body-token');
    });
  });

  describe('validate', () => {
    const payload: JwtPayload = {
      sub: 'user-1',
      email: 'user@example.com',
      role: UserRole.PROCUREMENT_OFFICER,
      companyId: 'company-1',
    };

    const activeUserWithHash = {
      id: 'user-1',
      email: 'user@example.com',
      role: UserRole.PROCUREMENT_OFFICER,
      status: UserStatus.ACTIVE,
      companyId: 'company-1',
      refreshTokenHash: 'hashed-refresh-token',
    };

    function makeReq(refreshToken?: string, source: 'cookie' | 'body' = 'cookie'): Request {
      if (source === 'cookie') {
        return {
          cookies: { jwt_refresh: refreshToken },
          headers: {},
          body: {},
        } as unknown as Request;
      }
      return {
        cookies: {},
        headers: {},
        body: { refreshToken },
      } as unknown as Request;
    }

    it('should return user for valid refresh token from cookie', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUserWithHash);
      mockedArgon2.verify.mockResolvedValue(true);

      const result = await strategy.validate(makeReq('valid-refresh-token', 'cookie'), payload);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          companyId: true,
          refreshTokenHash: true,
        },
      });
      expect(mockedArgon2.verify).toHaveBeenCalledWith(
        'hashed-refresh-token',
        'valid-refresh-token',
      );
      expect(result).toEqual(activeUserWithHash);
    });

    it('should return user for valid refresh token from body (fallback)', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUserWithHash);
      mockedArgon2.verify.mockResolvedValue(true);

      const result = await strategy.validate(makeReq('valid-refresh-token', 'body'), payload);

      expect(mockedArgon2.verify).toHaveBeenCalledWith(
        'hashed-refresh-token',
        'valid-refresh-token',
      );
      expect(result).toEqual(activeUserWithHash);
    });

    it('should throw UnauthorizedException when refresh token is missing', async () => {
      await expect(strategy.validate(makeReq(undefined), payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(makeReq(undefined), payload)).rejects.toThrow(
        'Refresh token missing',
      );
    });

    it('should throw UnauthorizedException when user is not active', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...activeUserWithHash,
        status: UserStatus.INACTIVE,
      });

      await expect(strategy.validate(makeReq('some-token'), payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(makeReq('some-token'), payload)).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should throw UnauthorizedException when user has no refreshTokenHash', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...activeUserWithHash,
        refreshTokenHash: null,
      });

      await expect(strategy.validate(makeReq('some-token'), payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(makeReq('some-token'), payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when argon2 verification fails', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUserWithHash);
      mockedArgon2.verify.mockResolvedValue(false);

      await expect(strategy.validate(makeReq('wrong-token'), payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(makeReq('wrong-token'), payload)).rejects.toThrow(
        'Invalid refresh token',
      );
    });
  });
});
