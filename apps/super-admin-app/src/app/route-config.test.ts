import { describe, it, expect } from 'vitest';

import { ROUTES } from './route-config';

describe('ROUTES', () => {
  it('defines all required auth routes', () => {
    expect(ROUTES.login).toBe('/login');
    expect(ROUTES.verifyOtp).toBe('/verify-otp');
    expect(ROUTES.activate).toBe('/activate');
    expect(ROUTES.forgotPassword).toBe('/forgot-password');
    expect(ROUTES.resetPassword).toBe('/reset-password');
  });

  it('defines home route as root', () => {
    expect(ROUTES.home).toBe('/');
  });

  it('defines admin-specific routes', () => {
    expect(ROUTES.companyDetail).toBe('/companies/:id');
    expect(ROUTES.users).toBe('/settings/users');
    expect(ROUTES.userDetail).toBe('/settings/users/:id');
    expect(ROUTES.settings).toBe('/settings');
  });

  it('all routes start with /', () => {
    for (const [, path] of Object.entries(ROUTES)) {
      expect(path).toMatch(/^\//);
    }
  });

  it('has no duplicate routes', () => {
    const values = Object.values(ROUTES);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
