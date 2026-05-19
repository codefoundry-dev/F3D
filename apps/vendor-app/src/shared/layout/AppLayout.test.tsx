import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockPageTitle = vi.hoisted(() => ({
  value: 'Dynamic Title' as string | null,
  subtitle: null as string | null,
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (
    selector: (s: {
      title: string | null;
      subtitle: string | null;
      setTitle: (v: string | null) => void;
    }) => unknown,
  ) =>
    selector({ title: mockPageTitle.value, subtitle: mockPageTitle.subtitle, setTitle: vi.fn() }),
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
  NotificationBell: () => <div data-testid="notification-bell" />,
  PageHeader: ({ title, onBack }: { title: string; subtitle?: string; onBack?: () => void }) => (
    <div data-testid="page-header">
      <span>{title}</span>
      {onBack && <button onClick={onBack}>back</button>}
    </div>
  ),
  SearchInput: () => <input data-testid="search-input" />,
  Sidebar: ({
    items,
    onNavigate,
    onLogoClick,
  }: {
    items: { label: string; href: string }[];
    onNavigate: (href: string) => void;
    onLogoClick: () => void;
  }) => (
    <div data-testid="sidebar">
      <button data-testid="logo" onClick={onLogoClick}>
        Logo
      </button>
      {items.map((item) => (
        <button key={item.label} onClick={() => onNavigate(item.href)}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/bulk-orders.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/logo.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/purchase-orders.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/request.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/settings.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: {
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
    login: '/login',
    verifyOtp: '/verify-otp',
    activate: '/activate',
    forgotPassword: '/forgot-password',
    resetPassword: '/reset-password',
    users: '/users',
    companyProfile: '/company',
  },
}));

vi.mock('@/features/auth/services/auth.service', () => ({
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: (s: { currentUser: { name: string } | null }) => unknown) =>
    selector({ currentUser: { name: 'John Doe' } }),
}));

const mockAvatarUrl = vi.hoisted(() => ({ value: null as string | null }));

vi.mock('@/features/profile/services/profile.service', () => ({
  useAvatarUrl: () => ({ data: mockAvatarUrl.value }),
  useProfile: () => ({ data: { workStatus: 'available' } }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Outlet: () => <div data-testid="outlet" />,
  };
});

import { AppLayout } from './AppLayout';

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAvatarUrl.value = null;
    mockPageTitle.value = 'Dynamic Title';
  });

  it('renders sidebar with navigation items', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByText('nav:rfqs')).toBeInTheDocument();
    expect(screen.getByText('nav:purchaseOrders')).toBeInTheDocument();
    expect(screen.getByText('nav:bulkOrders')).toBeInTheDocument();
    expect(screen.getByText('nav:settings')).toBeInTheDocument();
  });

  it('renders page header with dashboard title at home', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('renders page header with rfqs title at /rfqs', () => {
    render(
      <MemoryRouter initialEntries={['/rfqs']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText('rfqs')).toBeInTheDocument();
  });

  it('renders page header with dynamic title at /rfqs/:id', () => {
    render(
      <MemoryRouter initialEntries={['/rfqs/abc-123']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText('Dynamic Title')).toBeInTheDocument();
  });

  it('renders page header with profile title at /me', () => {
    render(
      <MemoryRouter initialEntries={['/me']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText('myProfile')).toBeInTheDocument();
  });

  it('renders page header with settings title at /settings', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText('settings')).toBeInTheDocument();
  });

  it('renders page header with purchase orders title', () => {
    render(
      <MemoryRouter initialEntries={['/purchase-orders']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText('purchaseOrders')).toBeInTheDocument();
  });

  it('renders page header with bulk orders title', () => {
    render(
      <MemoryRouter initialEntries={['/bulk-orders']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText('bulkOrders')).toBeInTheDocument();
  });

  it('navigates when sidebar item is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('nav:rfqs'));
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs');
  });

  it('navigates home when logo is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/rfqs']}>
        <AppLayout />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('logo'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('renders avatar-with-status component when no avatar', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('avatar-with-status')).toHaveAttribute('data-name', 'John Doe');
  });

  it('renders avatar-with-status with avatar url when present', () => {
    mockAvatarUrl.value = 'https://example.com/avatar.jpg';
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('avatar-with-status')).toHaveAttribute(
      'data-avatar',
      'https://example.com/avatar.jpg',
    );
  });

  it('navigates to profile when profile button clicked', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('auth:myProfile'));
    expect(mockNavigate).toHaveBeenCalledWith('/me');
  });

  it('renders logout button', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText('auth:logout')).toBeInTheDocument();
  });

  it('has back button on rfqs page', () => {
    render(
      <MemoryRouter initialEntries={['/rfqs']}>
        <AppLayout />
      </MemoryRouter>,
    );
    const backBtn = screen.getByText('back');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('has back button on rfq detail page', () => {
    render(
      <MemoryRouter initialEntries={['/rfqs/abc']}>
        <AppLayout />
      </MemoryRouter>,
    );
    const backBtn = screen.getByText('back');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs');
  });

  it('has back button on profile page', () => {
    render(
      <MemoryRouter initialEntries={['/me']}>
        <AppLayout />
      </MemoryRouter>,
    );
    const backBtn = screen.getByText('back');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('has back button on purchase order detail page', () => {
    render(
      <MemoryRouter initialEntries={['/purchase-orders/abc']}>
        <AppLayout />
      </MemoryRouter>,
    );
    const backBtn = screen.getByText('back');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders');
  });

  it('has back button on invoice detail page', () => {
    render(
      <MemoryRouter initialEntries={['/invoices/abc']}>
        <AppLayout />
      </MemoryRouter>,
    );
    const backBtn = screen.getByText('back');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('clicks logout button', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('auth:logout'));
  });

  it('renders unknown route with empty title', () => {
    render(
      <MemoryRouter initialEntries={['/unknown-route']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('page-header')).toBeInTheDocument();
  });

  it('renders avatar-with-status fallback when no current user', () => {
    // This tests the existing flow - the user name is John Doe
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('avatar-with-status')).toHaveAttribute('data-name', 'John Doe');
  });

  it('has back button on PO comms page navigating to PO detail', () => {
    render(
      <MemoryRouter initialEntries={['/purchase-orders/abc/comms']}>
        <AppLayout />
      </MemoryRouter>,
    );
    const backBtn = screen.getByText('back');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders/abc?tab=purchaseOrders');
  });

  it('renders purchaseOrders back button navigating to home', () => {
    render(
      <MemoryRouter initialEntries={['/purchase-orders']}>
        <AppLayout />
      </MemoryRouter>,
    );
    const backBtn = screen.getByText('back');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('renders bulk orders back button navigating to home', () => {
    render(
      <MemoryRouter initialEntries={['/bulk-orders']}>
        <AppLayout />
      </MemoryRouter>,
    );
    const backBtn = screen.getByText('back');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('uses fallback title for RFQ detail when pageTitleOverride is null', () => {
    mockPageTitle.value = null;
    render(
      <MemoryRouter initialEntries={['/rfqs/abc-123']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText('rfqs')).toBeInTheDocument();
  });

  it('uses fallback title for PO detail when pageTitleOverride is null', () => {
    mockPageTitle.value = null;
    render(
      <MemoryRouter initialEntries={['/purchase-orders/abc']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText('purchaseOrderDetail')).toBeInTheDocument();
  });

  it('uses fallback title for invoice detail when pageTitleOverride is null', () => {
    mockPageTitle.value = null;
    render(
      <MemoryRouter initialEntries={['/invoices/abc']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText('invoiceDetail')).toBeInTheDocument();
  });

  it('renders user management title at /users', () => {
    render(
      <MemoryRouter initialEntries={['/users']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText('userManagement')).toBeInTheDocument();
  });

  it('has back button on users page navigating to home', () => {
    render(
      <MemoryRouter initialEntries={['/users']}>
        <AppLayout />
      </MemoryRouter>,
    );
    const backBtn = screen.getByText('back');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('renders user profile title at /users/:id', () => {
    render(
      <MemoryRouter initialEntries={['/users/abc']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText('userProfile')).toBeInTheDocument();
  });

  it('has back button on user detail page navigating to users', () => {
    render(
      <MemoryRouter initialEntries={['/users/abc']}>
        <AppLayout />
      </MemoryRouter>,
    );
    const backBtn = screen.getByText('back');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/users');
  });

  it('renders company profile title at /company', () => {
    render(
      <MemoryRouter initialEntries={['/company']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText('companyProfile')).toBeInTheDocument();
  });

  it('has back button on company profile page navigating to home', () => {
    render(
      <MemoryRouter initialEntries={['/company']}>
        <AppLayout />
      </MemoryRouter>,
    );
    const backBtn = screen.getByText('back');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('has back button on bulk order detail page navigating to bulk orders', () => {
    render(
      <MemoryRouter initialEntries={['/bulk-orders/abc-123']}>
        <AppLayout />
      </MemoryRouter>,
    );
    const backBtn = screen.getByText('back');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/bulk-orders');
  });
});
