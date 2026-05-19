import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: (s: { title: string | null }) => unknown) =>
    selector({ title: 'Dynamic Title' }),
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
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
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

vi.mock('@forethread/ui-components/assets/icons/invoice.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/logo.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/settings.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: {
    home: '/',
    invoices: '/invoices',
    invoiceDetail: '/invoices/:id',
    settings: '/settings',
    me: '/me',
    login: '/login',
    verifyOtp: '/verify-otp',
    activate: '/activate',
    forgotPassword: '/forgot-password',
    resetPassword: '/reset-password',
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
  });

  it('renders sidebar with navigation items', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByText('nav:invoices')).toBeInTheDocument();
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

  it('renders page header with invoices title at /invoices', () => {
    render(
      <MemoryRouter initialEntries={['/invoices']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText('invoices')).toBeInTheDocument();
  });

  it('renders page header with dynamic title at /invoices/:id', () => {
    render(
      <MemoryRouter initialEntries={['/invoices/abc-123']}>
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

  it('navigates when sidebar item is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('nav:invoices'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices');
  });

  it('navigates home when logo is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/invoices']}>
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

  it('has back button on invoices page', () => {
    render(
      <MemoryRouter initialEntries={['/invoices']}>
        <AppLayout />
      </MemoryRouter>,
    );
    const backBtn = screen.getByText('back');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('has back button on invoice detail page', () => {
    render(
      <MemoryRouter initialEntries={['/invoices/abc']}>
        <AppLayout />
      </MemoryRouter>,
    );
    const backBtn = screen.getByText('back');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/invoices');
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

  it('renders empty title for unknown route', () => {
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('page-header')).toBeInTheDocument();
  });
});
