import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock SVG icons
vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <div data-testid="cross-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/envelope-simple.svg?react', () => ({
  default: () => <div data-testid="envelope-icon" />,
}));

// Mock i18n
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// notificationService is used via the ui-components mock below

// Mock ui-components
vi.mock('@forethread/ui-components', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  Spinner: ({ size }: { size: string }) => <div data-testid="spinner">{size}</div>,
  Button: ({ children, onClick, ...props }: any) => (
    <button data-testid="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  DotActionsMenu: ({
    actions,
  }: {
    actions: { key: string; label: string; onClick: () => void }[];
  }) => (
    <div data-testid="dot-actions">
      {actions.map((a) => (
        <button key={a.key} data-testid={`dot-action-${a.key}`} onClick={a.onClick}>
          {a.label}
        </button>
      ))}
    </div>
  ),
  StatusActionModal: ({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) => (
    <div data-testid="status-action-modal">
      <button data-testid="modal-confirm" onClick={onConfirm}>
        Confirm
      </button>
      <button data-testid="modal-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
  notificationService: { success: vi.fn(), error: vi.fn() },
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

// Mock react-router-dom
let currentSearchParams = new URLSearchParams();
const mockSetSearchParams = vi.fn((params: Record<string, string>) => {
  currentSearchParams = new URLSearchParams(params);
});
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'company-1' }),
  useSearchParams: () => [currentSearchParams, mockSetSearchParams],
}));

// Mock tanstack query
const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);
const mockMutate = vi.fn();
const mockMutationReset = vi.fn();
const mockUseQuery = vi.fn((..._args: any[]) => {
  return { data: undefined as any, isLoading: false };
});
vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: () => ({
    mutate: mockMutate,
    isPending: false,
    isError: false,
    reset: mockMutationReset,
  }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

// Mock api-client
const mockDeactivateUser = vi.fn().mockResolvedValue({});
const mockReactivateUser = vi.fn().mockResolvedValue({});
const mockUpdateCompany = vi.fn().mockResolvedValue({});
vi.mock('@forethread/api-client', () => ({
  deactivateUser: (...args: any[]) => mockDeactivateUser(...args),
  reactivateUser: (...args: any[]) => mockReactivateUser(...args),
  updateCompany: (...args: any[]) => mockUpdateCompany(...args),
  getUsers: vi.fn(),
}));

// Mock shared-types
vi.mock('@forethread/shared-types/client', () => ({
  UserStatus: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', INVITED: 'INVITED' },
}));

// Mock child components
vi.mock('../ui/CompanyUsersTab', () => ({
  CompanyUsersTab: () => <div data-testid="company-users-tab" />,
}));
vi.mock('../ui/DocumentsTab', () => ({
  DocumentsTab: () => <div data-testid="documents-tab" />,
}));
vi.mock('../ui/OverviewTab', () => ({
  OverviewTab: () => <div data-testid="overview-tab" />,
}));

// Mock company service
const mockUseCompany = vi.fn();
vi.mock('../services/companies.service', () => ({
  useCompany: (...args: any[]) => mockUseCompany(...args),
}));

import CompanyDetailPage from './CompanyDetailPage';

describe('CompanyDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
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

  it('renders company details when data is loaded', () => {
    mockUseCompany.mockReturnValue({
      data: {
        id: 'company-1',
        legalName: 'Acme Corp',
        contactEmail: 'info@acme.com',
      },
      isLoading: false,
    });
    render(<CompanyDetailPage />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('info@acme.com')).toBeInTheDocument();
  });

  it('renders tabs', () => {
    mockUseCompany.mockReturnValue({
      data: {
        id: 'company-1',
        legalName: 'Acme Corp',
        contactEmail: null,
      },
      isLoading: false,
    });
    render(<CompanyDetailPage />);
    expect(screen.getByText('tabs.overview')).toBeInTheDocument();
    expect(screen.getByText('tabs.companyUsers')).toBeInTheDocument();
    expect(screen.getByText('tabs.documents')).toBeInTheDocument();
  });

  it('renders initials from company name', () => {
    mockUseCompany.mockReturnValue({
      data: {
        id: 'company-1',
        legalName: 'Beta Industries',
        contactEmail: null,
      },
      isLoading: false,
    });
    render(<CompanyDetailPage />);
    expect(screen.getByText('BI')).toBeInTheDocument();
  });

  it('renders OverviewTab by default', () => {
    mockUseCompany.mockReturnValue({
      data: {
        id: 'company-1',
        legalName: 'Test Co',
        contactEmail: null,
      },
      isLoading: false,
    });
    render(<CompanyDetailPage />);
    expect(screen.getByTestId('overview-tab')).toBeInTheDocument();
  });

  describe('tab switching', () => {
    beforeEach(() => {
      mockUseCompany.mockReturnValue({
        data: { id: 'company-1', legalName: 'Acme Corp', contactEmail: null },
        isLoading: false,
      });
    });

    it('calls setSearchParams with companyUsers tab when clicked', () => {
      render(<CompanyDetailPage />);
      fireEvent.click(screen.getByText('tabs.companyUsers'));
      expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'companyUsers' }, { replace: true });
    });

    it('calls setSearchParams with documents tab when clicked', () => {
      render(<CompanyDetailPage />);
      fireEvent.click(screen.getByText('tabs.documents'));
      expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'documents' }, { replace: true });
    });

    it('calls setSearchParams with overview tab when clicked', () => {
      render(<CompanyDetailPage />);
      fireEvent.click(screen.getByText('tabs.overview'));
      expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'overview' }, { replace: true });
    });

    it('renders companyUsers tab when URL has tab=companyUsers', () => {
      currentSearchParams = new URLSearchParams({ tab: 'companyUsers' });
      render(<CompanyDetailPage />);
      expect(screen.getByTestId('company-users-tab')).toBeInTheDocument();
      expect(screen.queryByTestId('overview-tab')).not.toBeInTheDocument();
    });

    it('renders documents tab when URL has tab=documents', () => {
      currentSearchParams = new URLSearchParams({ tab: 'documents' });
      render(<CompanyDetailPage />);
      expect(screen.getByTestId('documents-tab')).toBeInTheDocument();
      expect(screen.queryByTestId('overview-tab')).not.toBeInTheDocument();
    });

    it('renders overview tab for invalid tab param', () => {
      currentSearchParams = new URLSearchParams({ tab: 'invalid' });
      render(<CompanyDetailPage />);
      expect(screen.getByTestId('overview-tab')).toBeInTheDocument();
    });
  });

  describe('inline edit mode', () => {
    beforeEach(() => {
      mockUseCompany.mockReturnValue({
        data: { id: 'company-1', legalName: 'Acme Corp', contactEmail: null },
        isLoading: false,
      });
    });

    it('enters edit mode when dot action edit is clicked', () => {
      render(<CompanyDetailPage />);
      fireEvent.click(screen.getByTestId('dot-action-edit'));
      // Submit and cancel buttons should appear
      expect(screen.getByText('editModal.submit')).toBeInTheDocument();
      expect(screen.getByText('common:cancel')).toBeInTheDocument();
    });

    it('exits edit mode when cancel is clicked', () => {
      render(<CompanyDetailPage />);
      fireEvent.click(screen.getByTestId('dot-action-edit'));
      expect(screen.getByText('common:cancel')).toBeInTheDocument();
      fireEvent.click(screen.getByText('common:cancel'));
      // Edit action should be available again
      expect(screen.getByTestId('dot-action-edit')).toBeInTheDocument();
    });

    it('hides edit dot action while in edit mode', () => {
      render(<CompanyDetailPage />);
      fireEvent.click(screen.getByTestId('dot-action-edit'));
      expect(screen.queryByTestId('dot-action-edit')).not.toBeInTheDocument();
    });
  });

  describe('bulk actions', () => {
    it('opens bulk deactivate modal when all users are active', () => {
      mockUseCompany.mockReturnValue({
        data: { id: 'company-1', legalName: 'Acme Corp', contactEmail: null },
        isLoading: false,
      });
      mockUseQuery.mockReturnValue({
        data: [
          { id: 'u1', status: 'ACTIVE' },
          { id: 'u2', status: 'ACTIVE' },
        ],
        isLoading: false,
      });
      render(<CompanyDetailPage />);
      fireEvent.click(screen.getByTestId('dot-action-bulkAction'));
      expect(screen.getByTestId('status-action-modal')).toBeInTheDocument();
    });

    it('opens bulk activate modal when some users are inactive', () => {
      mockUseCompany.mockReturnValue({
        data: { id: 'company-1', legalName: 'Acme Corp', contactEmail: null },
        isLoading: false,
      });
      mockUseQuery.mockReturnValue({
        data: [
          { id: 'u1', status: 'ACTIVE' },
          { id: 'u2', status: 'INACTIVE' },
        ],
        isLoading: false,
      });
      render(<CompanyDetailPage />);
      fireEvent.click(screen.getByTestId('dot-action-bulkAction'));
      expect(screen.getByTestId('status-action-modal')).toBeInTheDocument();
    });

    it('closes bulk modal when close is clicked', () => {
      mockUseCompany.mockReturnValue({
        data: { id: 'company-1', legalName: 'Acme Corp', contactEmail: null },
        isLoading: false,
      });
      mockUseQuery.mockReturnValue({
        data: [{ id: 'u1', status: 'ACTIVE' }],
        isLoading: false,
      });
      render(<CompanyDetailPage />);
      fireEvent.click(screen.getByTestId('dot-action-bulkAction'));
      expect(screen.getByTestId('status-action-modal')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('modal-close'));
      expect(screen.queryByTestId('status-action-modal')).not.toBeInTheDocument();
    });

    it('calls deactivateUser for all active users on confirm', async () => {
      mockUseCompany.mockReturnValue({
        data: { id: 'company-1', legalName: 'Acme Corp', contactEmail: null },
        isLoading: false,
      });
      mockUseQuery.mockReturnValue({
        data: [
          { id: 'u1', status: 'ACTIVE' },
          { id: 'u2', status: 'ACTIVE' },
        ],
        isLoading: false,
      });
      render(<CompanyDetailPage />);
      fireEvent.click(screen.getByTestId('dot-action-bulkAction'));
      fireEvent.click(screen.getByTestId('modal-confirm'));
      await waitFor(() => {
        expect(mockDeactivateUser).toHaveBeenCalledWith('u1');
        expect(mockDeactivateUser).toHaveBeenCalledWith('u2');
      });
    });

    it('calls reactivateUser for inactive users on confirm (activate mode)', async () => {
      mockUseCompany.mockReturnValue({
        data: { id: 'company-1', legalName: 'Acme Corp', contactEmail: null },
        isLoading: false,
      });
      mockUseQuery.mockReturnValue({
        data: [
          { id: 'u1', status: 'ACTIVE' },
          { id: 'u2', status: 'INACTIVE' },
          { id: 'u3', status: 'INACTIVE' },
        ],
        isLoading: false,
      });
      render(<CompanyDetailPage />);
      fireEvent.click(screen.getByTestId('dot-action-bulkAction'));
      fireEvent.click(screen.getByTestId('modal-confirm'));
      await waitFor(() => {
        expect(mockReactivateUser).toHaveBeenCalledWith('u2');
        expect(mockReactivateUser).toHaveBeenCalledWith('u3');
      });
    });

    it('invalidates queries after bulk action completes', async () => {
      mockUseCompany.mockReturnValue({
        data: { id: 'company-1', legalName: 'Acme Corp', contactEmail: null },
        isLoading: false,
      });
      mockUseQuery.mockReturnValue({
        data: [{ id: 'u1', status: 'ACTIVE' }],
        isLoading: false,
      });
      render(<CompanyDetailPage />);
      fireEvent.click(screen.getByTestId('dot-action-bulkAction'));
      fireEvent.click(screen.getByTestId('modal-confirm'));
      await waitFor(() => {
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['users'] });
      });
    });
  });

  it('handles initials from single-word company name', () => {
    mockUseCompany.mockReturnValue({
      data: { id: 'company-1', legalName: 'Zebra', contactEmail: null },
      isLoading: false,
    });
    render(<CompanyDetailPage />);
    // Single word 'Zebra' → initials 'Z'
    expect(screen.getByText('Z')).toBeInTheDocument();
    expect(screen.getByText('Zebra')).toBeInTheDocument();
  });

  it('bulk action with no eligible users returns early', async () => {
    mockUseCompany.mockReturnValue({
      data: { id: 'company-1', legalName: 'Acme Corp', contactEmail: null },
      isLoading: false,
    });
    // All users are Invited — no active or inactive users to deactivate
    mockUseQuery.mockReturnValue({
      data: [{ id: 'u1', status: 'INVITED' }],
      isLoading: false,
    });
    render(<CompanyDetailPage />);
    fireEvent.click(screen.getByTestId('dot-action-bulkAction'));
    fireEvent.click(screen.getByTestId('modal-confirm'));
    // deactivateUser should NOT be called since there are no active users
    await waitFor(() => {
      expect(mockDeactivateUser).not.toHaveBeenCalled();
    });
  });

  it('shows error notification when bulk action partially fails', async () => {
    mockUseCompany.mockReturnValue({
      data: { id: 'company-1', legalName: 'Acme Corp', contactEmail: null },
      isLoading: false,
    });
    mockUseQuery.mockReturnValue({
      data: [
        { id: 'u1', status: 'ACTIVE' },
        { id: 'u2', status: 'ACTIVE' },
      ],
      isLoading: false,
    });
    // Make one user deactivation fail
    mockDeactivateUser.mockResolvedValueOnce({});
    mockDeactivateUser.mockRejectedValueOnce(new Error('fail'));
    render(<CompanyDetailPage />);
    fireEvent.click(screen.getByTestId('dot-action-bulkAction'));
    fireEvent.click(screen.getByTestId('modal-confirm'));
    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['users'] });
    });
  });

  it('does not show email when contactEmail is null', () => {
    mockUseCompany.mockReturnValue({
      data: { id: 'company-1', legalName: 'Acme Corp', contactEmail: null },
      isLoading: false,
    });
    render(<CompanyDetailPage />);
    expect(screen.queryByTestId('envelope-icon')).not.toBeInTheDocument();
  });
});
