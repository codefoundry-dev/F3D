import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNavigate = vi.fn();
const mockLogoutMutate = vi.fn();
let mockPathname = '/';
let mockCurrentUser: { name: string } | null = { name: 'John Doe' };
let mockAvatarUrl: string | null = null;

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
  NotificationBell: (props: Record<string, unknown>) => (
    <div data-testid="notification-bell" aria-label={props['aria-label'] as string} />
  ),
  PageHeader: ({
    title,
    subtitle,
    onBack,
  }: {
    title: string;
    subtitle: string;
    onBack?: () => void;
  }) => (
    <div data-testid="page-header">
      <span data-testid="page-title">{title}</span>
      <span data-testid="page-subtitle">{subtitle}</span>
      {onBack && (
        <button data-testid="back-btn" onClick={onBack}>
          back
        </button>
      )}
    </div>
  ),
  SearchInput: ({ placeholder }: { placeholder: string }) => (
    <input data-testid="search-input" placeholder={placeholder} />
  ),
  Sidebar: ({ items, onNavigate, onLogoClick }: Record<string, unknown>) => (
    <div data-testid="sidebar">
      <button data-testid="logo" onClick={onLogoClick as () => void}>
        Logo
      </button>
      {(items as Array<{ label: string; href: string }>).map((item) => (
        <button
          key={item.href}
          data-testid={`nav-${item.label}`}
          onClick={() => (onNavigate as (href: string) => void)(item.href)}
        >
          {item.label}
        </button>
      ))}
    </div>
  ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/logo.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/settings.svg?react', () => ({
  default: () => <div />,
}));

vi.mock('react-router-dom', () => ({
  Outlet: () => <div data-testid="outlet">Page content</div>,
  useLocation: () => ({ pathname: mockPathname }),
  useNavigate: () => mockNavigate,
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: {
    home: '/',
    login: '/login',
    verifyOtp: '/verify-otp',
    activate: '/activate',
    forgotPassword: '/forgot-password',
    resetPassword: '/reset-password',
    settings: '/settings',
    me: '/me',
  },
}));

vi.mock('@/features/auth/services/auth.service', () => ({
  useLogout: () => ({ mutate: mockLogoutMutate, isPending: false }),
}));

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: (s: { currentUser: typeof mockCurrentUser }) => unknown) =>
    selector({ currentUser: mockCurrentUser }),
}));

vi.mock('@/features/profile/services/profile.service', () => ({
  useAvatarUrl: () => ({ data: mockAvatarUrl }),
  useProfile: () => ({ data: { workStatus: 'available' } }),
}));

import { AppLayout } from './AppLayout';

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/';
    mockCurrentUser = { name: 'John Doe' };
    mockAvatarUrl = null;
  });

  it('renders sidebar with settings nav item', () => {
    render(<AppLayout />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('nav-nav:settings')).toBeInTheDocument();
  });

  it('renders page header with dashboard title on home', () => {
    mockPathname = '/';
    render(<AppLayout />);
    expect(screen.getByTestId('page-title')).toHaveTextContent('dashboard');
  });

  it('renders page header with profile title on /me', () => {
    mockPathname = '/me';
    render(<AppLayout />);
    expect(screen.getByTestId('page-title')).toHaveTextContent('myProfile');
  });

  it('shows back button on profile page', () => {
    mockPathname = '/me';
    render(<AppLayout />);
    expect(screen.getByTestId('back-btn')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('renders settings page title', () => {
    mockPathname = '/settings';
    render(<AppLayout />);
    expect(screen.getByTestId('page-title')).toHaveTextContent('settings');
  });

  it('renders outlet for page content', () => {
    render(<AppLayout />);
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('navigates to home on logo click', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('logo'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('navigates to settings on sidebar click', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByTestId('nav-nav:settings'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('renders avatar-with-status component when no avatar', () => {
    mockAvatarUrl = null;
    render(<AppLayout />);
    expect(screen.getByTestId('avatar-with-status')).toHaveAttribute('data-name', 'John Doe');
  });

  it('renders avatar-with-status with avatar url when present', () => {
    mockAvatarUrl = 'https://example.com/avatar.jpg';
    render(<AppLayout />);
    expect(screen.getByTestId('avatar-with-status')).toHaveAttribute(
      'data-avatar',
      'https://example.com/avatar.jpg',
    );
  });

  it('renders avatar with empty name when no current user', () => {
    mockCurrentUser = null;
    render(<AppLayout />);
    expect(screen.getByTestId('avatar-with-status')).toHaveAttribute('data-name', '');
  });

  it('navigates to profile on my profile click', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByText('auth:myProfile'));
    expect(mockNavigate).toHaveBeenCalledWith('/me');
  });

  it('calls logout on logout click', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByText('auth:logout'));
    expect(mockLogoutMutate).toHaveBeenCalled();
  });

  it('renders notification bell', () => {
    render(<AppLayout />);
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<AppLayout />);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('falls back to empty title for unknown routes', () => {
    mockPathname = '/unknown-route';
    render(<AppLayout />);
    expect(screen.getByTestId('page-title')).toHaveTextContent('');
  });
});
