import { describe, it, expect, vi } from 'vitest';

vi.mock('@forethread/ui-components', () => ({
  PageLoader: () => <div>Loading...</div>,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@/shared/components/ErrorPage', () => ({
  ErrorPage: () => <div>Error</div>,
}));

vi.mock('@/shared/components/PrivateRoute', () => ({
  PrivateRoute: () => <div>Private</div>,
}));

vi.mock('@/shared/components/GuestRoute', () => ({
  GuestRoute: () => <div>Guest</div>,
}));

vi.mock('@/shared/layout/AppLayout', () => ({
  AppLayout: () => <div>Layout</div>,
}));

vi.mock('./route-config', () => ({
  ROUTES: {
    login: '/login',
    verifyOtp: '/verify-otp',
    activate: '/activate',
    forgotPassword: '/forgot-password',
    resetPassword: '/reset-password',
    home: '/',
    settings: '/settings',
    me: '/me',
  },
}));

vi.mock('@/features/auth/ui/LoginPage', () => ({ default: () => <div>Login</div> }));
vi.mock('@/features/auth/ui/WarehouseOfficerVerifyOtpPage', () => ({
  default: () => <div>OTP</div>,
}));
vi.mock('@/features/auth/ui/WarehouseOfficerActivateAccountPage', () => ({
  default: () => <div>Activate</div>,
}));
vi.mock('@/features/auth/ui/ForgotPasswordPage', () => ({ default: () => <div>Forgot</div> }));
vi.mock('@/features/auth/ui/WarehouseOfficerResetPasswordPage', () => ({
  default: () => <div>Reset</div>,
}));
vi.mock('@/features/dashboard/pages/DashboardPage', () => ({
  default: () => <div>Dashboard</div>,
}));
vi.mock('@/features/settings/pages/SettingsPage', () => ({ default: () => <div>Settings</div> }));
vi.mock('@/features/profile/pages/UserProfilePage', () => ({ default: () => <div>Profile</div> }));

import { routes } from './routes';

describe('routes', () => {
  it('exports routes array', () => {
    expect(routes).toBeDefined();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
  });

  it('has an error element at root level', () => {
    expect(routes[0].errorElement).toBeDefined();
  });

  it('defines guest-only routes under GuestRoute', () => {
    const children = routes[0].children!;
    const guestGroup = children.find(
      (r) => !('path' in r) && 'element' in r && 'children' in r,
    ) as { children: Array<{ path: string }> };
    expect(guestGroup).toBeDefined();

    const guestPaths = guestGroup.children.map((r) => r.path);
    expect(guestPaths).toContain('/login');
    expect(guestPaths).toContain('/verify-otp');
    expect(guestPaths).toContain('/forgot-password');
  });

  it('defines always-accessible public routes', () => {
    const children = routes[0].children!;
    const publicPaths = children
      .filter((r) => 'path' in r)
      .map((r) => (r as { path: string }).path);

    expect(publicPaths).toContain('/activate');
    expect(publicPaths).toContain('/reset-password');
  });

  it('defines protected routes under PrivateRoute', () => {
    const children = routes[0].children!;
    // The protected route group is the second pathless group (after GuestRoute)
    const pathlessGroups = children.filter(
      (r) => !('path' in r) && 'element' in r && 'children' in r,
    );
    // GuestRoute is first, PrivateRoute is second
    const protectedGroup = pathlessGroups[1] as {
      children: Array<{ children: Array<{ path: string }> }>;
    };
    expect(protectedGroup).toBeDefined();

    const layoutGroup = protectedGroup.children[0];
    const protectedPaths = layoutGroup.children.map((r) => r.path);

    expect(protectedPaths).toContain('/');
    expect(protectedPaths).toContain('/settings');
    expect(protectedPaths).toContain('/me');
  });
});
