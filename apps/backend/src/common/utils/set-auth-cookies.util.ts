import { CookieOptions, Request, Response } from 'express';

export const JWT_COOKIE_NAMES = {
  ACCESS: 'jwt',
  REFRESH: 'jwt_refresh',
} as const;

// Cookie maxAge values (in milliseconds) — should match JWT expiry
const ACCESS_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Builds app-scoped cookie names from the X-App-Id header.
 * e.g. X-App-Id: "company-admin" → "jwt_company-admin", "jwt_refresh_company-admin"
 * Falls back to the default names when no header is present.
 */
export function getCookieNames(req: Request): { access: string; refresh: string } {
  const appId = req.headers['x-app-id'] as string | undefined;
  if (appId) {
    return {
      access: `${JWT_COOKIE_NAMES.ACCESS}_${appId}`,
      refresh: `${JWT_COOKIE_NAMES.REFRESH}_${appId}`,
    };
  }
  return { access: JWT_COOKIE_NAMES.ACCESS, refresh: JWT_COOKIE_NAMES.REFRESH };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  req: Request,
): void {
  const isProd = process.env['NODE_ENV'] === 'production';
  const names = getCookieNames(req);

  const baseCookieOptions: CookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
  };

  // Access token cookie — short-lived (matches JWT expiry)
  res.cookie(names.access, accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });

  // Refresh token cookie — long-lived (matches JWT expiry)
  res.cookie(names.refresh, refreshToken, {
    ...baseCookieOptions,
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

export function clearAuthCookies(res: Response, req: Request): void {
  const names = getCookieNames(req);
  res.clearCookie(names.access, { path: '/' });
  res.clearCookie(names.refresh, { path: '/' });
}
