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

/**
 * Shared cookie attributes for both setting and clearing auth cookies.
 *
 * These MUST be identical between set and clear: browsers only delete a cookie
 * when the clearing `Set-Cookie` carries the same path/sameSite/secure/httpOnly
 * as the cookie that set it. In production the frontend is cross-site from the
 * API, so cookies are `SameSite=None; Secure` — and a cross-site response is
 * only allowed to set (or expire) a cookie when it is `SameSite=None; Secure`.
 * A loosely-specified clear (e.g. just `{ path: '/' }`) defaults to
 * `SameSite=Lax` and is silently ignored by the browser, leaving the user
 * logged in after logout.
 */
function baseCookieOptions(): CookieOptions {
  const isProd = process.env['NODE_ENV'] === 'production';
  return {
    path: '/',
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
  };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  req: Request,
): void {
  const names = getCookieNames(req);
  const base = baseCookieOptions();

  // Access token cookie — short-lived (matches JWT expiry)
  res.cookie(names.access, accessToken, {
    ...base,
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });

  // Refresh token cookie — long-lived (matches JWT expiry)
  res.cookie(names.refresh, refreshToken, {
    ...base,
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

export function clearAuthCookies(res: Response, req: Request): void {
  const names = getCookieNames(req);
  // Same attributes as setAuthCookies (minus maxAge) so the browser actually
  // deletes the cookies — especially cross-site in production.
  const base = baseCookieOptions();

  res.clearCookie(names.access, base);
  res.clearCookie(names.refresh, base);
}
