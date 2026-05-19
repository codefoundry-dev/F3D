vi.mock('@forethread/ui-components', () => ({
  PageLoader: () => <div>Loading...</div>,
}));

vi.mock('@/shared/components/ErrorPage', () => ({
  ErrorPage: () => <div>Error</div>,
}));

vi.mock('@/shared/components/PrivateRoute', () => ({
  PrivateRoute: () => <div>PrivateRoute</div>,
}));

vi.mock('@/shared/components/GuestRoute', () => ({
  GuestRoute: () => <div>GuestRoute</div>,
}));

vi.mock('@/shared/layout/AppLayout', () => ({
  AppLayout: () => <div>AppLayout</div>,
}));

vi.mock('./route-config', () => ({
  ROUTES: {
    login: '/login',
    verifyOtp: '/verify-otp',
    activate: '/activate',
    forgotPassword: '/forgot-password',
    resetPassword: '/reset-password',
    home: '/',
    rfqs: '/rfqs',
    rfqDetail: '/rfqs/:id',
    purchaseOrders: '/purchase-orders',
    purchaseOrderDetail: '/purchase-orders/:id',
    bulkOrders: '/bulk-orders',
    bulkOrderDetail: '/bulk-orders/:id',
    invoiceDetail: '/invoices/:id',
    settings: '/settings',
    me: '/me',
  },
}));

vi.mock('@/features/auth/ui/LoginPage', () => ({ default: () => <div>Login</div> }));
vi.mock('@/features/auth/ui/VendorVerifyOtpPage', () => ({ default: () => <div>VerifyOtp</div> }));
vi.mock('@/features/auth/ui/VendorActivateAccountPage', () => ({
  default: () => <div>Activate</div>,
}));
vi.mock('@/features/auth/ui/ForgotPasswordPage', () => ({
  default: () => <div>ForgotPassword</div>,
}));
vi.mock('@/features/auth/ui/VendorResetPasswordPage', () => ({
  default: () => <div>ResetPassword</div>,
}));
vi.mock('@/features/dashboard/pages/DashboardPage', () => ({
  default: () => <div>Dashboard</div>,
}));
vi.mock('@/features/rfqs/pages/RfqListPage', () => ({ default: () => <div>RfqList</div> }));
vi.mock('@/features/rfqs/pages/RfqDetailPage', () => ({ default: () => <div>RfqDetail</div> }));
vi.mock('@/features/purchase-orders/pages/PurchaseOrderListPage', () => ({
  default: () => <div>PoList</div>,
}));
vi.mock('@/features/purchase-orders/pages/PurchaseOrderDetailPage', () => ({
  default: () => <div>PoDetail</div>,
}));
vi.mock('@/features/bulk-orders/pages/BulkOrderListPage', () => ({
  default: () => <div>BulkList</div>,
}));
vi.mock('@/features/bulk-orders/pages/BulkOrderDetailPage', () => ({
  default: () => <div>BulkDetail</div>,
}));
vi.mock('@/features/invoices/pages/InvoiceDetailPage', () => ({
  default: () => <div>InvoiceDetail</div>,
}));
vi.mock('@/features/settings/pages/SettingsPage', () => ({ default: () => <div>Settings</div> }));
vi.mock('@/features/profile/pages/UserProfilePage', () => ({
  default: () => <div>UserProfile</div>,
}));

import { routes } from './routes';

describe('routes', () => {
  it('exports routes array', () => {
    expect(routes).toBeDefined();
    expect(Array.isArray(routes)).toBe(true);
  });

  it('has a top-level route with errorElement', () => {
    expect(routes[0]).toHaveProperty('errorElement');
  });

  it('has children routes', () => {
    expect(routes[0].children).toBeDefined();
    expect(routes[0].children!.length).toBeGreaterThan(0);
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

  it('includes a protected route group', () => {
    const children = routes[0].children!;
    const pathlessGroups = children.filter(
      (r) => !('path' in r) && 'element' in r && 'children' in r,
    );
    // GuestRoute is first, PrivateRoute is second
    const protectedRoute = pathlessGroups[1];
    expect(protectedRoute).toBeDefined();
    expect(protectedRoute.children).toBeDefined();
  });
});
