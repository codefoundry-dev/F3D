import {
  setAuthCookies,
  clearAuthCookies,
  JWT_COOKIE_NAMES,
  getCookieNames,
} from './set-auth-cookies.util';

describe('set-auth-cookies.util', () => {
  let mockRes: { cookie: jest.Mock; clearCookie: jest.Mock };
  let mockReq: { headers: Record<string, string | undefined> };

  beforeEach(() => {
    mockRes = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    mockReq = { headers: {} };
  });

  describe('getCookieNames', () => {
    it('returns default names when no X-App-Id header', () => {
      const names = getCookieNames(mockReq as never);
      expect(names).toEqual({
        access: JWT_COOKIE_NAMES.ACCESS,
        refresh: JWT_COOKIE_NAMES.REFRESH,
      });
    });

    it('returns app-scoped names when X-App-Id header is present', () => {
      mockReq.headers['x-app-id'] = 'company-admin';
      const names = getCookieNames(mockReq as never);
      expect(names).toEqual({
        access: 'jwt_company-admin',
        refresh: 'jwt_refresh_company-admin',
      });
    });
  });

  describe('setAuthCookies', () => {
    it('sets access and refresh cookies with default names in non-production', () => {
      const origEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      setAuthCookies(mockRes as never, 'access-tok', 'refresh-tok', mockReq as never);

      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        JWT_COOKIE_NAMES.ACCESS,
        'access-tok',
        expect.objectContaining({ sameSite: 'lax', secure: false, maxAge: 24 * 60 * 60 * 1000 }),
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        JWT_COOKIE_NAMES.REFRESH,
        'refresh-tok',
        expect.objectContaining({
          sameSite: 'lax',
          secure: false,
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );

      process.env['NODE_ENV'] = origEnv;
    });

    it('sets app-scoped cookie names when X-App-Id header is present', () => {
      const origEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';
      mockReq.headers['x-app-id'] = 'vendor';

      setAuthCookies(mockRes as never, 'access-tok', 'refresh-tok', mockReq as never);

      expect(mockRes.cookie).toHaveBeenCalledWith('jwt_vendor', 'access-tok', expect.any(Object));
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'jwt_refresh_vendor',
        'refresh-tok',
        expect.any(Object),
      );

      process.env['NODE_ENV'] = origEnv;
    });

    it('sets secure cookies in production', () => {
      const origEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      setAuthCookies(mockRes as never, 'access-tok', 'refresh-tok', mockReq as never);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        JWT_COOKIE_NAMES.ACCESS,
        'access-tok',
        expect.objectContaining({ sameSite: 'none', secure: true, maxAge: 24 * 60 * 60 * 1000 }),
      );

      process.env['NODE_ENV'] = origEnv;
    });
  });

  describe('clearAuthCookies', () => {
    it('clears both cookies with default names', () => {
      clearAuthCookies(mockRes as never, mockReq as never);

      expect(mockRes.clearCookie).toHaveBeenCalledTimes(2);
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        JWT_COOKIE_NAMES.ACCESS,
        expect.objectContaining({ path: '/', httpOnly: true }),
      );
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        JWT_COOKIE_NAMES.REFRESH,
        expect.objectContaining({ path: '/', httpOnly: true }),
      );
    });

    it('clears app-scoped cookies when X-App-Id header is present', () => {
      mockReq.headers['x-app-id'] = 'procurement-officer';

      clearAuthCookies(mockRes as never, mockReq as never);

      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'jwt_procurement-officer',
        expect.objectContaining({ path: '/' }),
      );
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'jwt_refresh_procurement-officer',
        expect.objectContaining({ path: '/' }),
      );
    });

    it('clears cookies with SameSite=None and Secure in production so cross-site logout works', () => {
      const origEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      clearAuthCookies(mockRes as never, mockReq as never);

      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        JWT_COOKIE_NAMES.ACCESS,
        expect.objectContaining({ sameSite: 'none', secure: true, path: '/' }),
      );
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        JWT_COOKIE_NAMES.REFRESH,
        expect.objectContaining({ sameSite: 'none', secure: true, path: '/' }),
      );

      process.env['NODE_ENV'] = origEnv;
    });
  });
});
