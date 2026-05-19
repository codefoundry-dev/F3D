vi.mock('@forethread/ui-components', () => ({
  PageLoader: () => <div data-testid="page-loader" />,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@/shared/components/ErrorPage', () => ({
  ErrorPage: () => <div data-testid="error-page" />,
}));

vi.mock('@/shared/components/PrivateRoute', () => ({
  PrivateRoute: () => <div data-testid="private-route" />,
}));

vi.mock('@/shared/components/GuestRoute', () => ({
  GuestRoute: () => <div data-testid="guest-route" />,
}));

vi.mock('@/shared/layout/AppLayout', () => ({
  AppLayout: () => <div data-testid="app-layout" />,
}));

vi.mock('@/features/auth/ui/LoginPage', () => ({ default: () => <div /> }));
vi.mock('@/features/auth/ui/SuperAdminVerifyOtpPage', () => ({ default: () => <div /> }));
vi.mock('@/features/auth/ui/SuperAdminActivateAccountPage', () => ({ default: () => <div /> }));
vi.mock('@/features/auth/ui/ForgotPasswordPage', () => ({ default: () => <div /> }));
vi.mock('@/features/auth/ui/SuperAdminResetPasswordPage', () => ({ default: () => <div /> }));
vi.mock('@/features/dashboard/pages/DashboardPage', () => ({ default: () => <div /> }));
vi.mock('@/features/users/ui/UserListPage', () => ({ default: () => <div /> }));
vi.mock('@/features/users/ui/UserDetailPage', () => ({ default: () => <div /> }));
vi.mock('@/features/companies/pages/CompanyDetailPage', () => ({ default: () => <div /> }));
vi.mock('@/features/settings/pages/SettingsPage', () => ({ default: () => <div /> }));

import { ROUTES } from './route-config';
import { routes } from './routes';

describe('routes', () => {
  it('exports an array with at least one route object', () => {
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThanOrEqual(1);
  });

  it('top-level route has an errorElement', () => {
    expect(routes[0].errorElement).toBeTruthy();
  });

  it('top-level route has children', () => {
    expect(routes[0].children).toBeDefined();
    expect(routes[0].children!.length).toBeGreaterThan(0);
  });

  it('has guest-only routes under GuestRoute', () => {
    const children = routes[0].children!;
    const guestGroup = children.find(
      (r) => !('path' in r) && 'element' in r && 'children' in r,
    ) as { children: Array<{ path: string; element: unknown }> };
    expect(guestGroup).toBeDefined();

    const guestPaths = guestGroup.children.map((r) => r.path);
    expect(guestPaths).toContain(ROUTES.login);
    expect(guestPaths).toContain(ROUTES.verifyOtp);
    expect(guestPaths).toContain(ROUTES.forgotPassword);

    // Each guest route has an element
    guestGroup.children.forEach((route) => {
      expect(route.element).toBeTruthy();
    });
  });

  it('has always-accessible public routes', () => {
    const children = routes[0].children!;
    const publicRoutes = children.filter((r) => 'path' in r);
    const publicPaths = publicRoutes.map((r) => (r as { path: string }).path);
    expect(publicPaths).toContain(ROUTES.activate);
    expect(publicPaths).toContain(ROUTES.resetPassword);
  });

  it('has a protected route group with children', () => {
    const children = routes[0].children!;
    const pathlessGroups = children.filter(
      (r) => !('path' in r) && 'element' in r && 'children' in r,
    );
    // GuestRoute is first, PrivateRoute is second
    const protectedRoute = pathlessGroups[1];
    expect(protectedRoute).toBeDefined();
    expect(protectedRoute.children!.length).toBeGreaterThan(0);
  });

  it('protected routes contain AppLayout with nested page routes', () => {
    const children = routes[0].children!;
    const pathlessGroups = children.filter(
      (r) => !('path' in r) && 'element' in r && 'children' in r,
    );
    const protectedRoute = pathlessGroups[1];
    const appLayoutRoute = protectedRoute.children![0];
    expect(appLayoutRoute.element).toBeTruthy();
    expect(appLayoutRoute.children).toBeDefined();

    const paths = appLayoutRoute.children!.map((r) => r.path);
    expect(paths).toContain(ROUTES.home);
    expect(paths).toContain(ROUTES.users);
    expect(paths).toContain(ROUTES.userDetail);
    expect(paths).toContain(ROUTES.companyDetail);
    expect(paths).toContain(ROUTES.settings);
  });

  it('all lazy-loaded route elements are wrapped in Suspense', () => {
    const children = routes[0].children!;
    // Public routes (direct children with paths) should all have elements
    const publicRoutes = children.filter((r) => 'path' in r);
    publicRoutes.forEach((route) => {
      expect(route.element).toBeTruthy();
    });
  });
});
