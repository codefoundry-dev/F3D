import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/department.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/file-text.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/info.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/new-user.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/users-group.svg?react', () => ({
  default: () => <div />,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  Spinner: () => <div data-testid="spinner" />,
  Button: ({ children, onClick, leftIcon: _l, isLoading: _il, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Tabs: ({ items, onValueChange }: any) => (
    <div data-testid="tabs">
      {items.map((it: any) => (
        <button key={it.value} onClick={() => onValueChange(it.value)}>
          {it.label}
        </button>
      ))}
    </div>
  ),
  DotActionsMenu: ({ actions }: any) => (
    <div data-testid="dot-actions">
      {actions.map((a: any) => (
        <button key={a.key} data-testid={`dot-action-${a.key}`} onClick={a.onClick}>
          {a.label}
        </button>
      ))}
    </div>
  ),
  StatusActionModal: ({ onConfirm, onClose }: any) => (
    <div data-testid="status-action-modal">
      <button data-testid="modal-confirm" onClick={onConfirm}>
        confirm
      </button>
      <button data-testid="modal-close" onClick={onClose}>
        close
      </button>
    </div>
  ),
  notificationService: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/features/companies/ui/CompanyProfileHeaderCard', () => ({
  CompanyProfileHeaderCard: ({ company, actions, onAvatarClick }: any) => (
    <div data-testid="header-card">
      <span>{company.legalName}</span>
      <button data-testid="avatar-btn" onClick={onAvatarClick}>
        avatar
      </button>
      {actions}
    </div>
  ),
}));
vi.mock('@/features/companies/ui/DocumentsTab', () => ({
  DocumentsTab: () => <div data-testid="documents-tab" />,
}));
vi.mock('@/features/companies/ui/OverviewTab', () => ({
  OverviewTab: () => <div data-testid="overview-tab" />,
}));
vi.mock('@/features/companies/ui/EditCompanyDetailsModal', () => ({
  EditCompanyDetailsModal: () => <div data-testid="edit-company-modal" />,
}));
vi.mock('@/features/users/company-admin/ui/CreateUserModal', () => ({
  CreateUserModal: () => <div data-testid="create-user-modal" />,
}));
vi.mock('@/features/users/company-admin/ui/InvitationSuccessModal', () => ({
  InvitationSuccessModal: () => <div data-testid="invitation-success-modal" />,
}));
vi.mock('../components/BuyerCompanyUsersTab', () => ({
  BuyerCompanyUsersTab: () => <div data-testid="buyer-company-users-tab" />,
}));

const mockOpenCreateModal = vi.fn();
const store: Record<string, unknown> = {};
vi.mock('@/features/users/company-admin/state/users.store', () => ({
  useUsersStore: () => store,
}));

const mockHandleLogoChange = vi.fn();
const mockOpenFilePicker = vi.fn();
const logoState = {
  logoUrl: null as string | null,
  inputRef: { current: null },
  isPending: false,
  handleLogoChange: mockHandleLogoChange,
  openFilePicker: mockOpenFilePicker,
};
vi.mock('../hooks/useCompanyLogo', () => ({
  useCompanyLogo: () => logoState,
}));

const mockUseAuthStore = vi.fn();
vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: any) => mockUseAuthStore(selector),
}));

let currentSearchParams = new URLSearchParams();
const mockSetSearchParams = vi.fn((params: Record<string, string>) => {
  currentSearchParams = new URLSearchParams(params);
});
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [currentSearchParams, mockSetSearchParams],
}));

const companyResult = { data: undefined as any, isLoading: false };
const usersResult = { data: undefined as any };
const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: any[] }) =>
    queryKey[0] === 'company-profile'
      ? companyResult
      : queryKey[0] === 'users'
        ? usersResult
        : { data: undefined },
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const mockDeactivateUser = vi.fn().mockResolvedValue({});
const mockReactivateUser = vi.fn().mockResolvedValue({});
vi.mock('@forethread/api-client', () => ({
  getCompany: vi.fn(),
  getUsers: vi.fn(),
  deactivateUser: (...a: any[]) => mockDeactivateUser(...a),
  reactivateUser: (...a: any[]) => mockReactivateUser(...a),
}));

vi.mock('@forethread/shared-types/client', () => ({
  UserStatus: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', INVITED: 'INVITED' },
}));

import CompanyProfilePage from './CompanyProfilePage';

const company = {
  id: 'c1',
  legalName: 'Acme Corp',
  contactEmail: 'info@acme.com',
  type: 'CONTRACTOR',
};

describe('CompanyProfilePage (buyer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    Object.assign(store, {
      isCreateModalOpen: false,
      openCreateModal: mockOpenCreateModal,
      closeCreateModal: vi.fn(),
      isSuccessModalOpen: false,
      closeSuccessModal: vi.fn(),
    });
    logoState.logoUrl = null;
    logoState.isPending = false;
    companyResult.data = company;
    companyResult.isLoading = false;
    usersResult.data = undefined;
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({ currentUser: { companyId: 'c1' } }),
    );
  });

  it('shows spinner when loading', () => {
    companyResult.data = undefined;
    companyResult.isLoading = true;
    render(<CompanyProfilePage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders nothing when company is null', () => {
    companyResult.data = undefined;
    companyResult.isLoading = false;
    const { container } = render(<CompanyProfilePage />);
    expect(container.innerHTML).toBe('');
  });

  it('renders company name + section title + tabs', () => {
    render(<CompanyProfilePage />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('companyDetails')).toBeInTheDocument();
    expect(screen.getByText('tabs.companyOverview')).toBeInTheDocument();
    expect(screen.getByText('tabs.companyUsers')).toBeInTheDocument();
    expect(screen.getByText('tabs.documents')).toBeInTheDocument();
  });

  it('renders overview tab by default and switches via setSearchParams', () => {
    render(<CompanyProfilePage />);
    expect(screen.getByTestId('overview-tab')).toBeInTheDocument();
    fireEvent.click(screen.getByText('tabs.companyUsers'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'companyUsers' }, { replace: true });
  });

  it('renders the buyer company-users tab when URL has tab=companyUsers', () => {
    currentSearchParams = new URLSearchParams({ tab: 'companyUsers' });
    render(<CompanyProfilePage />);
    expect(screen.getByTestId('buyer-company-users-tab')).toBeInTheDocument();
  });

  it('invite button calls openCreateModal', () => {
    render(<CompanyProfilePage />);
    fireEvent.click(screen.getByText('users:inviteUser'));
    expect(mockOpenCreateModal).toHaveBeenCalled();
  });

  it('renders create + invitation-success modals from store flags', () => {
    store.isCreateModalOpen = true;
    store.isSuccessModalOpen = true;
    render(<CompanyProfilePage />);
    expect(screen.getByTestId('create-user-modal')).toBeInTheDocument();
    expect(screen.getByTestId('invitation-success-modal')).toBeInTheDocument();
  });

  it('edit dot action opens the edit-company modal', () => {
    render(<CompanyProfilePage />);
    fireEvent.click(screen.getByTestId('dot-action-edit'));
    expect(screen.getByTestId('edit-company-modal')).toBeInTheDocument();
  });

  it('avatar click triggers the logo file picker', () => {
    render(<CompanyProfilePage />);
    fireEvent.click(screen.getByTestId('avatar-btn'));
    expect(mockOpenFilePicker).toHaveBeenCalled();
  });

  it('file input change triggers handleLogoChange', () => {
    render(<CompanyProfilePage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([''], 'l.png', { type: 'image/png' })] },
    });
    expect(mockHandleLogoChange).toHaveBeenCalled();
  });

  it('bulk deactivate confirm calls deactivateUser for active users', async () => {
    usersResult.data = [
      { id: 'u1', status: 'ACTIVE' },
      { id: 'u2', status: 'ACTIVE' },
    ];
    render(<CompanyProfilePage />);
    fireEvent.click(screen.getByTestId('dot-action-bulkAction'));
    fireEvent.click(screen.getByTestId('modal-confirm'));
    await waitFor(() => {
      expect(mockDeactivateUser).toHaveBeenCalledWith('u1');
      expect(mockDeactivateUser).toHaveBeenCalledWith('u2');
    });
  });
});
