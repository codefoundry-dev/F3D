import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ERR } from '../../common/constants/error-messages.const';

import {
  ACCESS_TOKEN_META_KEY,
  ACCESS_TOKEN_REQUEST_PROPERTY,
  type AccessTokenMeta,
} from './access-token.decorators';
import { AccessTokensService } from './access-tokens.service';

/**
 * Guard for tokenized vendor endpoints (FOR-201). Resolves the token from
 * `?token=` query string or `X-Access-Token` header, validates it, then
 * attaches the resolved row at `request[ACCESS_TOKEN_REQUEST_PROPERTY]`.
 *
 * Use together with `@RequireAccessToken({ expectedPurpose: ... })` on the
 * route handler.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokensService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<AccessTokenMeta | undefined>(
      ACCESS_TOKEN_META_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) return true; // Guard is a no-op on routes that don't opt in.

    const request = context.switchToHttp().getRequest<Request & Record<string, unknown>>();
    const rawToken = extractRawToken(request);
    if (!rawToken) {
      throw new ForbiddenException(ERR.accessTokens.missing);
    }

    const ip = resolveClientIp(request);
    const token = await this.accessTokens.validateToken(rawToken, {
      expectedPurpose: meta.expectedPurpose,
      expectedSubjectType: meta.expectedSubjectType,
      ip,
    });

    request[ACCESS_TOKEN_REQUEST_PROPERTY] = token;
    return true;
  }
}

function extractRawToken(request: Request): string | null {
  const headerVal = request.headers['x-access-token'];
  if (typeof headerVal === 'string' && headerVal.length > 0) return headerVal;
  if (Array.isArray(headerVal) && headerVal[0]) return headerVal[0];

  const queryVal = (request.query as Record<string, unknown> | undefined)?.token;
  if (typeof queryVal === 'string' && queryVal.length > 0) return queryVal;

  return null;
}

function resolveClientIp(request: Request): string | null {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }
  return request.ip ?? request.socket?.remoteAddress ?? null;
}
