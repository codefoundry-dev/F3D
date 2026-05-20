import { UserRole } from '@forethread/shared-types/client';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components/assets/icons/arrow-right.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/department.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/new-user.svg?react', () => ({
  default: () => <div />,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockUseUserRole = vi.fn();
vi.mock('@/shared/role', () => ({
  useUserRole: () => mockUseUserRole(),
}));

import SettingsPage from './SettingsPage';

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Users + Company links for COMPANY_ADMIN', () => {
    mockUseUserRole.mockReturnValue(UserRole.COMPANY_ADMIN);
    render(<SettingsPage />);
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('company')).toBeInTheDocument();
  });

  it('renders only Users for SUPER_ADMIN', () => {
    mockUseUserRole.mockReturnValue(UserRole.SUPER_ADMIN);
    render(<SettingsPage />);
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.queryByText('company')).not.toBeInTheDocument();
  });

  it('renders only Company for PROCUREMENT_OFFICER', () => {
    mockUseUserRole.mockReturnValue(UserRole.PROCUREMENT_OFFICER);
    render(<SettingsPage />);
    expect(screen.queryByText('users')).not.toBeInTheDocument();
    expect(screen.getByText('company')).toBeInTheDocument();
  });

  it('renders Users + Company for VENDOR', () => {
    mockUseUserRole.mockReturnValue(UserRole.VENDOR);
    render(<SettingsPage />);
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('company')).toBeInTheDocument();
  });

  it('renders empty-state subtitle for FINANCIAL_OFFICER (no items visible)', () => {
    mockUseUserRole.mockReturnValue(UserRole.FINANCIAL_OFFICER);
    render(<SettingsPage />);
    expect(screen.queryByText('users')).not.toBeInTheDocument();
    expect(screen.queryByText('company')).not.toBeInTheDocument();
    expect(screen.getByText('settingsSubtitle')).toBeInTheDocument();
  });

  it('renders empty-state subtitle for WAREHOUSE_OFFICER', () => {
    mockUseUserRole.mockReturnValue(UserRole.WAREHOUSE_OFFICER);
    render(<SettingsPage />);
    expect(screen.getByText('settingsSubtitle')).toBeInTheDocument();
  });

  it('renders empty-state subtitle when role is null', () => {
    mockUseUserRole.mockReturnValue(null);
    render(<SettingsPage />);
    expect(screen.getByText('settingsSubtitle')).toBeInTheDocument();
  });

  it('navigates to /users when clicking the users link', () => {
    mockUseUserRole.mockReturnValue(UserRole.COMPANY_ADMIN);
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('users'));
    expect(mockNavigate).toHaveBeenCalledWith('/users');
  });

  it('navigates to /company when clicking the company link', () => {
    mockUseUserRole.mockReturnValue(UserRole.COMPANY_ADMIN);
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('company'));
    expect(mockNavigate).toHaveBeenCalledWith('/company');
  });
});
