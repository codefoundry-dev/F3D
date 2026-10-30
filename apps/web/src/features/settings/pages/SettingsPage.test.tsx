import { UserRole } from '@forethread/shared-types/client';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: any) => selector({ setTitle: vi.fn() }),
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
vi.mock('@forethread/ui-components/assets/icons/settings.svg?react', () => ({
  default: () => <div />,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockUseUserRole = vi.fn();
const mockPermissions = vi.hoisted(() => ({ keys: [] as string[] }));
vi.mock('@/shared/role', () => ({
  useUserRole: () => mockUseUserRole(),
  usePermissions: () => ({ has: (key: string) => mockPermissions.keys.includes(key) }),
}));

const mockCompanyId = vi.hoisted(() => ({ value: 'company-1' as string | null }));
vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ currentUser: { companyId: mockCompanyId.value } }),
}));

vi.mock('@/features/company-profile/buyer/components/CompanyLogoCard', () => ({
  CompanyLogoCard: ({ companyId }: { companyId: string }) => (
    <div data-testid="company-logo-card">{companyId}</div>
  ),
}));

vi.mock('../components/PoTermsCard', () => ({
  PoTermsCard: ({ companyId }: { companyId: string }) => (
    <div data-testid="po-terms-card">{companyId}</div>
  ),
}));

vi.mock('../components/ProcurementAutomationCard', () => ({
  ProcurementAutomationCard: ({ companyId }: { companyId: string }) => (
    <div data-testid="procurement-automation-card">{companyId}</div>
  ),
}));

import SettingsPage from './SettingsPage';

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions.keys = [];
    mockCompanyId.value = 'company-1';
  });

  describe('procurement automation card (FOR-396)', () => {
    it('shows the MR → RFQ automation toggle to a Company Admin', () => {
      mockUseUserRole.mockReturnValue(UserRole.COMPANY_ADMIN);
      render(<SettingsPage />);
      expect(screen.getByTestId('procurement-automation-card')).toHaveTextContent('company-1');
    });

    it('hides it from a Procurement Officer', () => {
      mockUseUserRole.mockReturnValue(UserRole.PROCUREMENT_OFFICER);
      render(<SettingsPage />);
      expect(screen.queryByTestId('procurement-automation-card')).not.toBeInTheDocument();
    });
  });

  describe('PO terms & conditions card (FOR-398)', () => {
    it('shows the default-terms editor to a Company Admin', () => {
      mockUseUserRole.mockReturnValue(UserRole.COMPANY_ADMIN);
      render(<SettingsPage />);
      expect(screen.getByTestId('po-terms-card')).toHaveTextContent('company-1');
    });

    it('hides it from a Procurement Officer', () => {
      mockUseUserRole.mockReturnValue(UserRole.PROCUREMENT_OFFICER);
      render(<SettingsPage />);
      expect(screen.queryByTestId('po-terms-card')).not.toBeInTheDocument();
    });
  });

  describe('company logo card (FOR-389)', () => {
    it('shows the logo card to a Procurement Officer holding company.updateLogo', () => {
      mockUseUserRole.mockReturnValue(UserRole.PROCUREMENT_OFFICER);
      mockPermissions.keys = ['company.updateLogo'];
      render(<SettingsPage />);
      expect(screen.getByTestId('company-logo-card')).toHaveTextContent('company-1');
    });

    it('hides the logo card without company.updateLogo', () => {
      mockUseUserRole.mockReturnValue(UserRole.FINANCIAL_OFFICER);
      render(<SettingsPage />);
      expect(screen.queryByTestId('company-logo-card')).not.toBeInTheDocument();
    });

    it('hides the logo card when the user has no company', () => {
      mockUseUserRole.mockReturnValue(UserRole.SUPER_ADMIN);
      mockPermissions.keys = ['company.updateLogo'];
      mockCompanyId.value = null;
      render(<SettingsPage />);
      expect(screen.queryByTestId('company-logo-card')).not.toBeInTheDocument();
    });
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

  it('renders empty settings for PROCUREMENT_OFFICER (no users or company access)', () => {
    mockUseUserRole.mockReturnValue(UserRole.PROCUREMENT_OFFICER);
    render(<SettingsPage />);
    expect(screen.queryByText('users')).not.toBeInTheDocument();
    expect(screen.queryByText('company')).not.toBeInTheDocument();
    expect(screen.getByText('settingsSubtitle')).toBeInTheDocument();
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

  it('hides the standalone roles link for COMPANY_ADMIN (moved to User Management tabs)', () => {
    mockUseUserRole.mockReturnValue(UserRole.COMPANY_ADMIN);
    render(<SettingsPage />);
    // 'title' is the i18n key for the roles section heading.
    expect(screen.queryByText('title')).not.toBeInTheDocument();
  });

  it('shows the roles link for SUPER_ADMIN and navigates to /settings/roles', () => {
    mockUseUserRole.mockReturnValue(UserRole.SUPER_ADMIN);
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('title'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings/roles');
  });

  it('hides the roles link for PROCUREMENT_OFFICER', () => {
    mockUseUserRole.mockReturnValue(UserRole.PROCUREMENT_OFFICER);
    render(<SettingsPage />);
    // 'title' is the i18n key for roles section
    expect(screen.queryByText('title')).not.toBeInTheDocument();
  });
});
