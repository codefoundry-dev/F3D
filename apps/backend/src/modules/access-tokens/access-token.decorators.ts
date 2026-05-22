import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AccessToken, AccessTokenPurpose, AccessTokenSubject } from '@prisma/client';

export const ACCESS_TOKEN_META_KEY = 'accessToken:meta';
export const ACCESS_TOKEN_REQUEST_PROPERTY = 'accessToken';

export interface AccessTokenMeta {
  expectedPurpose: AccessTokenPurpose;
  expectedSubjectType?: AccessTokenSubject;
}

/**
 * Mark a route as requiring a valid access token (FOR-201). Combine with
 * `@Public()` if the route should also bypass JWT auth (typical for vendor
 * tokenized links).
 */
export const RequireAccessToken = (meta: AccessTokenMeta): MethodDecorator & ClassDecorator =>
  SetMetadata(ACCESS_TOKEN_META_KEY, meta);

/** Parameter decorator to inject the resolved AccessToken row into a handler. */
export const CurrentAccessToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessToken => {
    const request = ctx.switchToHttp().getRequest<Record<string, unknown>>();
    return request[ACCESS_TOKEN_REQUEST_PROPERTY] as AccessToken;
  },
);
