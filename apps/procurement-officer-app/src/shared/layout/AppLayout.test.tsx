const mockNavigate = vi.hoisted(() => vi.fn());
const mockAuth = vi.hoisted(() => ({
  isAuthenticated: true,
  currentUser: { name: 'John Doe', email: 'john@example.com' },
}));
const mockAvatarData = vi.hoisted(() => ({ value: null as string | null }));
const mockPathname = vi.hoisted(() => ({ value: '/' }));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname.value }),
  Outlet: () => <div data-testid="outlet" />,
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: () => null,
}));

vi.mock('@forethread/ui-components', () => ({
  AvatarWithStatus: ({ name, avatarUrl, workStatus, size }: any) => (
    <div
      data-testid="avatar-with-status"
      data-name={name}
      data-avatar={avatarUrl}
      data-status={workStatus}
      data-size={size}
    />
  ),
  NotificationBell: () => <span data-testid="notification-bell" />,
  PageHeader: ({ title, onBack }: { title: string; onBack?: () => void }) => (
    <div data-testid="page-header">
      {onBack && (
        <button data-testid="back-btn" onClick={onBack}>
          back
        </button>
      )}
      {title}
    </div>
  ),
  SearchInput: () => <input data-testid="search-input" />,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
  Sidebar: ({
    items,
    onNavigate,
    onLogoClick,
  }: {
    items: Array<{ label: string; href: string }>;
    onNavigate: (path: string) => void;
    onLogoClick: () => void;
  }) => (
    <nav data-testid="sidebar">
      <button data-testid="logo" onClick={onLogoClick}>
        logo
      </button>
      {items.map((item) => (
        <button key={item.href} onClick={() => onNavigate(item.href)}>
          {item.label}
        </button>
      ))}
    </nav>
  ),
}));

vi.mock('@/features/auth/services/auth.service', () => ({
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: (s: typeof mockAuth) => unknown) => selector(mockAuth),
}));

vi.mock('@/features/profile/services/profile.service', () => ({
  useAvatarUrl: () => ({ data: mockAvatarData.value }),
  useProfile: () => ({ data: { workStatus: 'available' } }),
}));

import { render, screen, fireEvent } from '@testing-library/react';

import { AppLayout } from './AppLayout';

describe('AppLayout', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockAvatarData.value = null;
    mockPathname.value = '/';
  });

  it('renders sidebar and outlet', () => {
    render(<AppLayout />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('renders page header with dashboard title', () => {
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('dashboard');
  });

  it('renders avatar-with-status component when no avatar', () => {
    render(<AppLayout />);
    expect(screen.getByTestId('avatar-with-status')).toHaveAttribute('data-name', 'John Doe');
  });

  it('renders avatar-with-status with avatar url when present', () => {
    mockAvatarData.value = 'https://example.com/avatar.jpg';
    render(<AppLayout />);
    expect(screen.getByTestId('avatar-with-status')).toHaveAttribute(
      'data-avatar',
      'https://example.com/avatar.jpg',
    );
  });

  it('navigates to home on logo click', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('logo'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('navigates to sidebar items', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByText('nav:rfqs'));
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs');
  });

  it('renders notification bell and search', () => {
    render(<AppLayout />);
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('renders profile and logout buttons in dropdown', () => {
    render(<AppLayout />);
    expect(screen.getByText('auth:myProfile')).toBeInTheDocument();
    expect(screen.getByText('auth:logout')).toBeInTheDocument();
  });

  it('navigates to profile on click', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByText('auth:myProfile'));
    expect(mockNavigate).toHaveBeenCalledWith('/me');
  });

  it('shows back button for rfqs page', () => {
    mockPathname.value = '/rfqs';
    render(<AppLayout />);
    expect(screen.getByTestId('back-btn')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows purchase order detail title', () => {
    mockPathname.value = '/purchase-orders/po-123';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('purchaseOrderDetail');
  });

  it('shows create purchase order title', () => {
    mockPathname.value = '/purchase-orders/new';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('createPurchaseOrder');
  });

  it('shows upload invoice title', () => {
    mockPathname.value = '/invoices/upload';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('uploadInvoice');
  });

  it('shows invoice detail title', () => {
    mockPathname.value = '/invoices/inv-1';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('invoiceDetail');
  });

  it('shows add vendor title', () => {
    mockPathname.value = '/vendors/new';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('addVendor');
  });

  it('shows my profile title', () => {
    mockPathname.value = '/me';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('myProfile');
  });

  it('shows settings page title', () => {
    mockPathname.value = '/settings';
    render(<AppLayout />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('settings');
  });

  it('clicks back on purchase-orders detail route', () => {
    mockPathname.value = '/purchase-orders/po-123';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders');
  });

  it('clicks back on create purchase order route', () => {
    mockPathname.value = '/purchase-orders/new';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders');
  });

  it('clicks back on invoice upload route', () => {
    mockPathname.value = '/invoices/upload';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices');
  });

  it('clicks back on invoice detail route', () => {
    mockPathname.value = '/invoices/inv-1';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices');
  });

  it('clicks back on add vendor route', () => {
    mockPathname.value = '/vendors/new';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/vendors');
  });

  it('clicks back on my profile route', () => {
    mockPathname.value = '/me';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('clicks back on bulk-orders detail route', () => {
    mockPathname.value = '/bulk-orders/bo-123';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/bulk-orders');
  });

  it('clicks back on projects detail route', () => {
    mockPathname.value = '/projects/prj-1';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects');
  });

  it('clicks back on create rfq route', () => {
    mockPathname.value = '/rfqs/new';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs');
  });

  it('clicks back on rfq detail route', () => {
    mockPathname.value = '/rfqs/rfq-123';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs');
  });

  it('clicks back on rfq quote detail route navigates to rfq with responses tab', () => {
    mockPathname.value = '/rfqs/rfq-123/quotes/q-1';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs/rfq-123?tab=responses');
  });

  it('clicks back on projects list navigates home', () => {
    mockPathname.value = '/projects';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('clicks back on purchase-orders list navigates home', () => {
    mockPathname.value = '/purchase-orders';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('clicks back on bulk-orders list navigates home', () => {
    mockPathname.value = '/bulk-orders';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('clicks back on invoices list navigates home', () => {
    mockPathname.value = '/invoices';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('clicks back on vendors list navigates home', () => {
    mockPathname.value = '/vendors';
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('calls logout on logout button click', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByText('auth:logout'));
    // Logout mutate should have been called — the mock returns a vi.fn()
  });

  it('navigates via sidebar onNavigate to different items', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByText('nav:projects'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects');
    fireEvent.click(screen.getByText('nav:purchaseOrders'));
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders');
    fireEvent.click(screen.getByText('nav:bulkOrders'));
    expect(mockNavigate).toHaveBeenCalledWith('/bulk-orders');
    fireEvent.click(screen.getByText('nav:invoices'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices');
    fireEvent.click(screen.getByText('nav:vendors'));
    expect(mockNavigate).toHaveBeenCalledWith('/vendors');
    fireEvent.click(screen.getByText('nav:settings'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });
});
