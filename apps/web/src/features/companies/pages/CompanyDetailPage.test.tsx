import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock SVG icons
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

// Child components
vi.mock('../ui/CompanyProfileHeaderCard', () => ({
  CompanyProfileHeaderCard: ({ company, actions }: any) => (
    <div data-testid="header-card">
      <span>{company.legalName}</span>
      {company.contactEmail && <span>{company.contactEmail}</span>}
      {actions}
    </div>
  ),
}));
vi.mock('../ui/CompanyUsersTab', () => ({
  CompanyUsersTab: () => <div data-testid="company-users-tab" />,
}));
vi.mock('../ui/DocumentsTab', () => ({ DocumentsTab: () => <div data-testid="documents-tab" /> }));
vi.mock('../ui/OverviewTab', () => ({ OverviewTab: () => <div data-testid="overview-tab" /> }));
vi.mock('../ui/EditCompanyDetailsModal', () => ({
  EditCompanyDetailsModal: () => <div data-testid="edit-company-modal" />,
}));
vi.mock('../../users/super-admin/ui/CreateUserModal', () => ({
  CreateUserModal: () => <div data-testid="create-user-modal" />,
}));

const mockOpenCreateModal = vi.fn();
const store: Record<string, unknown> = {};
vi.mock('@/features/users/super-admin/state/users.store', () => ({
  useUsersStore: () => store,
}));

// react-router-dom
let currentSearchParams = new URLSearchParams();
const mockSetSearchParams = vi.fn((params: Record<string, string>) => {
  currentSearchParams = new URLSearchParams(params);
});
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'company-1' }),
  useSearchParams: () => [currentSearchParams, mockSetSearchParams],
}));

// tanstack query (only the companyUsers list query is used directly)
const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);
const mockUseQuery = vi.fn((..._args: any[]) => ({ data: undefined as any }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const mockDeactivateUser = vi.fn().mockResolvedValue({});
const mockReactivateUser = vi.fn().mockResolvedValue({});
vi.mock('@forethread/api-client', () => ({
  deactivateUser: (...a: any[]) => mockDeactivateUser(...a),
  reactivateUser: (...a: any[]) => mockReactivateUser(...a),
  getUsers: vi.fn(),
}));

vi.mock('@forethread/shared-types/client', () => ({
  CompanyType: { CONTRACTOR: 'CONTRACTOR', VENDOR: 'VENDOR' },
  UserStatus: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', INVITED: 'INVITED' },
}));

const mockUseCompany = vi.fn();
vi.mock('../services/companies.service', () => ({
  useCompany: (...a: any[]) => mockUseCompany(...a),
}));

import CompanyDetailPage from './CompanyDetailPage';

function resetStore() {
  Object.assign(store, {
    isCreateModalOpen: false,
    openCreateModal: mockOpenCreateModal,
    closeCreateModal: vi.fn(),
  });
}

const company = {
  id: 'company-1',
  legalName: 'Acme Corp',
  contactEmail: 'info@acme.com',
  type: 'CONTRACTOR',
};

describe('CompanyDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    resetStore();
    mockUseQuery.mockReturnValue({ data: undefined });
    mockUseCompany.mockReturnValue({ data: company, isLoading: false });
  });

  it('renders spinner when loading', () => {
    mockUseCompany.mockReturnValue({ data: undefined, isLoading: true });
    render(<CompanyDetailPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders nothing when company is not found', () => {
    mockUseCompany.mockReturnValue({ data: undefined, isLoading: false });
    const { container } = render(<CompanyDetailPage />);
    expect(container.innerHTML).toBe('');
  });

  it('renders company name + section title', () => {
    render(<CompanyDetailPage />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('companyDetails')).toBeInTheDocument();
  });

  it('renders the three tabs', () => {
    render(<CompanyDetailPage />);
    expect(screen.getByText('tabs.companyOverview')).toBeInTheDocument();
    expect(screen.getByText('tabs.companyUsers')).toBeInTheDocument();
    expect(screen.getByText('tabs.documents')).toBeInTheDocument();
  });

  it('renders the overview tab by default', () => {
    render(<CompanyDetailPage />);
    expect(screen.getByTestId('overview-tab')).toBeInTheDocument();
  });

  it('switches tab via setSearchParams', () => {
    render(<CompanyDetailPage />);
    fireEvent.click(screen.getByText('tabs.companyUsers'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'companyUsers' }, { replace: true });
  });

  it('renders companyUsers tab when URL has tab=companyUsers', () => {
    currentSearchParams = new URLSearchParams({ tab: 'companyUsers' });
    render(<CompanyDetailPage />);
    expect(screen.getByTestId('company-users-tab')).toBeInTheDocument();
  });

  it('renders documents tab when URL has tab=documents', () => {
    currentSearchParams = new URLSearchParams({ tab: 'documents' });
    render(<CompanyDetailPage />);
    expect(screen.getByTestId('documents-tab')).toBeInTheDocument();
  });

  it('invite button calls openCreateModal', () => {
    render(<CompanyDetailPage />);
    fireEvent.click(screen.getByText('users:inviteUser'));
    expect(mockOpenCreateModal).toHaveBeenCalled();
  });

  it('renders the create-user modal when the store flag is set', () => {
    store.isCreateModalOpen = true;
    render(<CompanyDetailPage />);
    expect(screen.getByTestId('create-user-modal')).toBeInTheDocument();
  });

  it('edit dot action opens the edit-company modal', () => {
    render(<CompanyDetailPage />);
    fireEvent.click(screen.getByTestId('dot-action-edit'));
    expect(screen.getByTestId('edit-company-modal')).toBeInTheDocument();
  });

  it('bulk deactivate confirm calls deactivateUser for active users', async () => {
    mockUseQuery.mockReturnValue({
      data: [
        { id: 'u1', status: 'ACTIVE' },
        { id: 'u2', status: 'ACTIVE' },
      ],
    });
    render(<CompanyDetailPage />);
    fireEvent.click(screen.getByTestId('dot-action-bulkAction'));
    fireEvent.click(screen.getByTestId('modal-confirm'));
    await waitFor(() => {
      expect(mockDeactivateUser).toHaveBeenCalledWith('u1');
      expect(mockDeactivateUser).toHaveBeenCalledWith('u2');
    });
  });

  it('bulk activate confirm calls reactivateUser for inactive users', async () => {
    mockUseQuery.mockReturnValue({
      data: [
        { id: 'u1', status: 'ACTIVE' },
        { id: 'u2', status: 'INACTIVE' },
      ],
    });
    render(<CompanyDetailPage />);
    fireEvent.click(screen.getByTestId('dot-action-bulkAction'));
    fireEvent.click(screen.getByTestId('modal-confirm'));
    await waitFor(() => {
      expect(mockReactivateUser).toHaveBeenCalledWith('u2');
    });
  });

  it('closes the bulk modal on cancel', () => {
    mockUseQuery.mockReturnValue({ data: [{ id: 'u1', status: 'ACTIVE' }] });
    render(<CompanyDetailPage />);
    fireEvent.click(screen.getByTestId('dot-action-bulkAction'));
    expect(screen.getByTestId('status-action-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('modal-close'));
    expect(screen.queryByTestId('status-action-modal')).not.toBeInTheDocument();
  });
});
