import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { ERR } from '../../../common/constants/error-messages.const';
import { JWT_COOKIE_NAMES, getCookieNames } from '../../../common/utils/set-auth-cookies.util';
import { PrismaService } from '../../../prisma/prisma.service';

import type { JwtPayload } from './jwt.strategy';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const cookies = req.cookies as Record<string, string> | undefined;
          if (!cookies) return null;
          const names = getCookieNames(req);
          return cookies[names.refresh] ?? cookies[JWT_COOKIE_NAMES.REFRESH] ?? null;
        },
        ExtractJwt.fromBodyField('refreshToken'),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const names = getCookieNames(req);
    const refreshToken: string | undefined =
      cookies?.[names.refresh] ??
      cookies?.[JWT_COOKIE_NAMES.REFRESH] ??
      (req.body as { refreshToken?: string }).refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException(ERR.auth.refreshTokenMissing);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        companyId: true,
        refreshTokenHash: true,
      },
    });

    if (user?.status !== UserStatus.ACTIVE || !user.refreshTokenHash) {
      throw new UnauthorizedException(ERR.auth.invalidRefreshToken);
    }

    const isValid = await argon2.verify(user.refreshTokenHash, refreshToken);

    if (!isValid) {
      throw new UnauthorizedException(ERR.auth.invalidRefreshToken);
    }

    return user;
  }
}
