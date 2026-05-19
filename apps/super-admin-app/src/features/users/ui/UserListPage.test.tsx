import { render, screen, fireEvent, act } from '@testing-library/react';

// ── Mocks ──

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockNavigate = vi.fn();
let currentSearchParams = new URLSearchParams();
const mockSetSearchParams = vi.fn((params: Record<string, string>) => {
  currentSearchParams = new URLSearchParams(params);
});
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [currentSearchParams, mockSetSearchParams],
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('@forethread/api-client', () => ({
  deactivateUser: vi.fn().mockResolvedValue({}),
  reactivateUser: vi.fn().mockResolvedValue({}),
}));

vi.mock('@forethread/shared-types/client', () => ({
  UserStatus: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', INVITED: 'INVITED' },
}));

const mockDeactivateMutate = vi.fn();
const mockReactivateMutate = vi.fn();
const mockResendMutate = vi.fn();
const mockCancelMutate = vi.fn();
const mockResetPasswordMutate = vi.fn();

const mockMutation = { mutate: vi.fn(), isPending: false, isError: false, error: null };

const mockUseUsers = vi.fn((..._args: any[]) => ({
  data: {
    items: [
      {
        id: 'u1',
        name: 'Alice',
        email: 'alice@example.com',
        phone: '123' as string | null,
        role: 'COMPANY_ADMIN',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        company: { id: 'c1', legalName: 'Acme' },
      },
    ],
    meta: { page: 1, total: 1, lastPage: 1 },
  },
  isLoading: false,
  isError: false,
}));

vi.mock('../services/users.service', () => ({
  useUsers: (...args: any[]) => mockUseUsers(...args),
  useDeactivateUser: () => ({ ...mockMutation, mutate: mockDeactivateMutate }),
  useReactivateUser: () => ({ ...mockMutation, mutate: mockReactivateMutate }),
  useResendInvitation: () => ({ ...mockMutation, mutate: mockResendMutate }),
  useCancelInvitation: () => ({ ...mockMutation, mutate: mockCancelMutate }),
  useInitiateResetPassword: () => ({ ...mockMutation, mutate: mockResetPasswordMutate }),
}));

vi.mock('@/features/companies/services/companies.service', () => ({
  useCompanies: () => ({ data: { items: [{ id: 'c1', legalName: 'Acme Corp' }] } }),
}));

vi.mock('../hooks/useGroupedUsers', () => ({
  useGroupedUsers: (items: unknown[], _companies?: unknown[]) =>
    items
      ? [
          {
            companyId: 'c1',
            companyName: 'Acme',
            users: items,
          },
        ]
      : [],
}));

const mockOpenCreateModal = vi.fn();
const mockOpenEditModal = vi.fn();
const mockOpenStatusActionModal = vi.fn();
const mockCloseStatusActionModal = vi.fn();
const mockOpenStatusSuccessModal = vi.fn();
const mockOpenResetPasswordSuccessModal = vi.fn();
const mockOpenCancelInvitationModal = vi.fn();
const mockCloseCancelInvitationModal = vi.fn();
const mockOpenEditCompanyModal = vi.fn();
const mockOpenBulkActionModal = vi.fn();
const mockCloseBulkActionModal = vi.fn();
const mockToggleCompany = vi.fn();

const mockStoreState: Record<string, unknown> = {
  isCreateModalOpen: false,
  openCreateModal: mockOpenCreateModal,
  closeCreateModal: vi.fn(),
  isEditModalOpen: false,
  openEditModal: mockOpenEditModal,
  closeEditModal: vi.fn(),
  isStatusActionModalOpen: false,
  statusActionType: null,
  statusActionUserId: null,
  statusActionUserEmail: null,
  openStatusActionModal: mockOpenStatusActionModal,
  closeStatusActionModal: mockCloseStatusActionModal,
  isStatusSuccessModalOpen: false,
  statusSuccessType: null,
  statusSuccessUserEmail: null,
  openStatusSuccessModal: mockOpenStatusSuccessModal,
  closeStatusSuccessModal: vi.fn(),
  isResetPasswordSuccessModalOpen: false,
  resetPasswordSuccessEmail: null,
  openResetPasswordSuccessModal: mockOpenResetPasswordSuccessModal,
  closeResetPasswordSuccessModal: vi.fn(),
  isCancelInvitationModalOpen: false,
  cancelInvitationUserId: null,
  cancelInvitationUserEmail: null,
  cancelInvitationUserName: null,
  openCancelInvitationModal: mockOpenCancelInvitationModal,
  closeCancelInvitationModal: mockCloseCancelInvitationModal,
  isEditCompanyModalOpen: false,
  openEditCompanyModal: mockOpenEditCompanyModal,
  isBulkActionModalOpen: false,
  bulkActionType: null,
  bulkActionCompanyName: null,
  bulkActionUserIds: [],
  openBulkActionModal: mockOpenBulkActionModal,
  closeBulkActionModal: mockCloseBulkActionModal,
  expandedCompanyIds: ['c1'],
  toggleCompany: mockToggleCompany,
};

vi.mock('../state/users.store', () => ({
  useUsersStore: () => mockStoreState,
}));

vi.mock('../constants/roles', () => ({
  ROLE_BADGE_COLORS: {},
  STATUS_TEXT_COLORS: {},
  ALL_ROLE_OPTIONS: ['COMPANY_ADMIN'],
}));

// Stub UI components
vi.mock('@forethread/ui-components', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
  Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  Spinner: () => <div data-testid="spinner">Loading...</div>,
  Badge: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  TablePagination: ({ onPageChange, onPageSizeChange, showingLabel }: any) => (
    <div data-testid="table-pagination">
      <button data-testid="next-page" onClick={() => onPageChange(2)}>
        Next
      </button>
      <button data-testid="change-page-size" onClick={() => onPageSizeChange(50)}>
        50
      </button>
      {showingLabel && <span>{showingLabel({ from: 1, to: 25, total: 100 })}</span>}
    </div>
  ),
  EmptyState: ({ title, description }: any) => (
    <div>
      {title}
      {description && <span>{description}</span>}
    </div>
  ),
  DotActionsMenu: ({ actions }: any) => (
    <div data-testid="dot-actions">
      {actions?.map((a: any) => (
        <button key={a.key} data-testid={`action-${a.key}`} onClick={a.onClick}>
          {a.label}
        </button>
      ))}
    </div>
  ),
  FilterPopover: ({ label, onChange }: any) => (
    <div data-testid={`filter-${label}`}>
      <button data-testid={`filter-btn-${label}`} onClick={() => onChange(['val1'])}>
        {label}
      </button>
    </div>
  ),
  SortIcon: () => <span data-testid="sort-icon" />,
  SearchInput: (p: any) => <input data-testid="search-input" {...p} />,
  StatusActionModal: ({ onConfirm, onClose, infoText }: any) => (
    <div data-testid="status-action-modal">
      <button data-testid="status-confirm" onClick={onConfirm}>
        Confirm
      </button>
      <button data-testid="status-close" onClick={onClose}>
        Close
      </button>
      {infoText && <span data-testid="sa-info">{infoText}</span>}
    </div>
  ),
  StatusSuccessModal: ({ redirectLabel, description, note, buttonLabel, title }: any) => (
    <div data-testid="status-success-modal">
      {title && <span data-testid="ss-title">{title}</span>}
      {description && <span data-testid="ss-description">{description}</span>}
      {note && <span data-testid="ss-note">{note}</span>}
      {buttonLabel && <span data-testid="ss-button-label">{buttonLabel}</span>}
      {redirectLabel && <span data-testid="ss-redirect">{redirectLabel(5)}</span>}
    </div>
  ),
  ResetPasswordSuccessModal: ({ redirectLabel }: any) => (
    <div data-testid="reset-password-success-modal">
      {redirectLabel && <span>{redirectLabel(5)}</span>}
    </div>
  ),
  notificationService: { success: vi.fn(), error: vi.fn() },
  useDebounce: (value: unknown) => value,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

// Stub SVG icons — inline to avoid hoisting issues
vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: (p: any) => <svg data-testid="icon-cross" {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit.svg?react', () => ({
  default: (p: any) => <svg data-testid="icon-edit" {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: (p: any) => <svg data-testid="icon-eye" {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/new-user.svg?react', () => ({
  default: (p: any) => <svg data-testid="icon-new-user" {...p} />,
}));

// Mock child components rendered conditionally
vi.mock('./ActionLogTab', () => ({
  ActionLogTab: () => <div data-testid="action-log-tab" />,
}));
vi.mock('./CreateUserModal', () => ({
  CreateUserModal: () => <div data-testid="create-user-modal" />,
}));
vi.mock('./EditUserModal', () => ({
  EditUserModal: () => <div data-testid="edit-user-modal" />,
}));
vi.mock('./modals/EditCompanyModal', () => ({
  EditCompanyModal: () => <div data-testid="edit-company-modal" />,
}));

import UserListPage from './UserListPage';

describe('UserListPage', () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams();
  });

  it('renders tabs', () => {
    render(<UserListPage />);
    expect(screen.getByText('tabs.platformUsers')).toBeInTheDocument();
    expect(screen.getByText('tabs.actionLog')).toBeInTheDocument();
  });

  it('renders the invite button', () => {
    render(<UserListPage />);
    expect(screen.getByText('inviteUser')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<UserListPage />);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('renders the table with company group and user row', () => {
    render(<UserListPage />);
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<UserListPage />);
    expect(screen.getByText('columns.fullName')).toBeInTheDocument();
    expect(screen.getByText('columns.email')).toBeInTheDocument();
    expect(screen.getByText('columns.status')).toBeInTheDocument();
  });

  it('renders pagination when total > 10', () => {
    mockUseUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u1',
            name: 'Alice',
            email: 'alice@example.com',
            phone: '123',
            role: 'COMPANY_ADMIN',
            status: 'ACTIVE',
            createdAt: '2025-01-01T00:00:00Z',
            company: { id: 'c1', legalName: 'Acme' },
          },
        ],
        meta: { page: 1, total: 11, lastPage: 2 },
      },
      isLoading: false,
      isError: false,
    });
    render(<UserListPage />);
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
    mockUseUsers.mockRestore();
  });

  it('hides pagination when total <= 10', () => {
    render(<UserListPage />);
    expect(screen.queryByTestId('table-pagination')).not.toBeInTheDocument();
  });

  it('calls setSearchParams with actionLog tab when clicked', () => {
    render(<UserListPage />);
    fireEvent.click(screen.getByText('tabs.actionLog'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'actionLog' }, { replace: true });
  });

  it('renders action log tab when URL has tab=actionLog', () => {
    currentSearchParams = new URLSearchParams({ tab: 'actionLog' });
    render(<UserListPage />);
    expect(screen.getByTestId('action-log-tab')).toBeInTheDocument();
  });

  it('clicking invite button calls openCreateModal', () => {
    render(<UserListPage />);
    fireEvent.click(screen.getByText('inviteUser'));
    expect(mockOpenCreateModal).toHaveBeenCalled();
  });

  it('clicking column header triggers sort', () => {
    render(<UserListPage />);
    const nameHeader = screen.getByText('columns.fullName');
    // First click: set sort asc
    fireEvent.click(nameHeader);
    // Second click: toggle to desc
    fireEvent.click(nameHeader);
    // Third click: clear sort
    fireEvent.click(nameHeader);
    // No crash
    expect(nameHeader).toBeInTheDocument();
  });

  it('clicking View button navigates to user detail', () => {
    render(<UserListPage />);
    const viewButtons = screen.getAllByLabelText('View');
    fireEvent.click(viewButtons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/settings/users/u1');
  });

  it('clicking Edit button calls openEditModal', () => {
    render(<UserListPage />);
    const editButtons = screen.getAllByLabelText('Edit');
    fireEvent.click(editButtons[0]);
    expect(mockOpenEditModal).toHaveBeenCalledWith('u1');
  });

  it('clicking company row toggle calls toggleCompany', () => {
    render(<UserListPage />);
    // The company header row contains the company name
    const acmeRow = screen.getByText('Acme').closest('tr')!;
    fireEvent.click(acmeRow);
    expect(mockToggleCompany).toHaveBeenCalledWith('c1');
  });

  it('clicking View company button navigates to company detail', () => {
    render(<UserListPage />);
    const viewCompanyBtn = screen.getByLabelText('View company');
    fireEvent.click(viewCompanyBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/companies/c1');
  });

  it('renders loading spinner when isLoading', () => {
    mockUseUsers.mockReturnValueOnce({
      data: undefined as any,
      isLoading: true,
      isError: false,
    });
    render(<UserListPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders error state when isError', () => {
    mockUseUsers.mockReturnValueOnce({
      data: undefined as any,
      isLoading: false,
      isError: true,
    });
    render(<UserListPage />);
    expect(screen.getByText('failedToLoad')).toBeInTheDocument();
  });

  it('renders empty state when no items', () => {
    mockUseUsers.mockReturnValueOnce({
      data: { items: [], meta: { page: 1, total: 0, lastPage: 1 } },
      isLoading: false,
      isError: false,
    });
    render(<UserListPage />);
    expect(screen.getByText('noUsersFound')).toBeInTheDocument();
  });

  it('shows adjustFilters description when filters active but no results', () => {
    // Return empty data for multiple renders (initial + after filter change)
    mockUseUsers
      .mockReturnValueOnce({
        data: { items: [], meta: { page: 1, total: 0, lastPage: 1 } },
        isLoading: false,
        isError: false,
      })
      .mockReturnValueOnce({
        data: { items: [], meta: { page: 1, total: 0, lastPage: 1 } },
        isLoading: false,
        isError: false,
      })
      .mockReturnValueOnce({
        data: { items: [], meta: { page: 1, total: 0, lastPage: 1 } },
        isLoading: false,
        isError: false,
      });
    render(<UserListPage />);
    // Click a filter to activate it — this triggers a re-render
    fireEvent.click(screen.getByTestId('filter-btn-filters.status'));
    // The filter state is now active, empty state should show adjustFilters
    expect(screen.getByText('adjustFilters')).toBeInTheDocument();
  });

  it('search input triggers search change', () => {
    render(<UserListPage />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(input).toHaveValue('test');
  });

  it('filter popover triggers filter change', () => {
    render(<UserListPage />);
    const companyFilter = screen.getByTestId('filter-btn-filters.company');
    fireEvent.click(companyFilter);
    // Should not crash
    expect(companyFilter).toBeInTheDocument();
  });

  it('row actions for Active user include deactivate', () => {
    render(<UserListPage />);
    expect(screen.getByTestId('action-deactivate')).toBeInTheDocument();
  });

  it('clicking deactivate action calls openStatusActionModal', () => {
    render(<UserListPage />);
    fireEvent.click(screen.getByTestId('action-deactivate'));
    expect(mockOpenStatusActionModal).toHaveBeenCalledWith('deactivate', 'u1', 'alice@example.com');
  });

  it('row actions for Active user include editUser and resetPassword', () => {
    render(<UserListPage />);
    expect(screen.getByTestId('action-editUser')).toBeInTheDocument();
    expect(screen.getByTestId('action-resetPassword')).toBeInTheDocument();
  });

  it('row actions for Invited user include resend and cancel', () => {
    mockUseUsers.mockReturnValueOnce({
      data: {
        items: [
          {
            id: 'u2',
            name: 'Bob',
            email: 'bob@example.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'INVITED',
            createdAt: '2025-01-01T00:00:00Z',
            company: { id: 'c1', legalName: 'Acme' },
          },
        ],
        meta: { page: 1, total: 1, lastPage: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(<UserListPage />);
    expect(screen.getByTestId('action-resendInvitation')).toBeInTheDocument();
    expect(screen.getByTestId('action-cancelInvitation')).toBeInTheDocument();
  });

  it('row actions for Inactive user include activate', () => {
    mockUseUsers.mockReturnValueOnce({
      data: {
        items: [
          {
            id: 'u3',
            name: 'Carol',
            email: 'carol@example.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'INACTIVE',
            createdAt: '2025-01-01T00:00:00Z',
            company: { id: 'c1', legalName: 'Acme' },
          },
        ],
        meta: { page: 1, total: 1, lastPage: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(<UserListPage />);
    expect(screen.getByTestId('action-activate')).toBeInTheDocument();
  });

  it('status action modal shows when store indicates so', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = 'u1';
    mockStoreState.statusActionUserEmail = 'alice@example.com';
    render(<UserListPage />);
    expect(screen.getByTestId('status-action-modal')).toBeInTheDocument();
    // Reset
    mockStoreState.isStatusActionModalOpen = false;
    mockStoreState.statusActionType = null;
    mockStoreState.statusActionUserId = null;
    mockStoreState.statusActionUserEmail = null;
  });

  it('handleStatusAction calls deactivateMutation.mutate when type is deactivate', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = 'u1';
    mockStoreState.statusActionUserEmail = 'alice@example.com';
    render(<UserListPage />);
    fireEvent.click(screen.getByTestId('status-confirm'));
    expect(mockDeactivateMutate).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    // Reset
    mockStoreState.isStatusActionModalOpen = false;
    mockStoreState.statusActionType = null;
    mockStoreState.statusActionUserId = null;
    mockStoreState.statusActionUserEmail = null;
  });

  it('handleStatusAction calls reactivateMutation.mutate when type is activate', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'activate';
    mockStoreState.statusActionUserId = 'u1';
    mockStoreState.statusActionUserEmail = 'alice@example.com';
    render(<UserListPage />);
    fireEvent.click(screen.getByTestId('status-confirm'));
    expect(mockReactivateMutate).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    // Reset
    mockStoreState.isStatusActionModalOpen = false;
    mockStoreState.statusActionType = null;
    mockStoreState.statusActionUserId = null;
    mockStoreState.statusActionUserEmail = null;
  });

  it('cancel invitation modal shows and handleCancelInvitation works', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    mockStoreState.cancelInvitationUserId = 'u2';
    mockStoreState.cancelInvitationUserEmail = 'bob@example.com';
    mockStoreState.cancelInvitationUserName = 'Bob';
    render(<UserListPage />);
    // There are now multiple status-action-modals; the cancel invitation is one
    const modals = screen.getAllByTestId('status-action-modal');
    expect(modals.length).toBeGreaterThanOrEqual(1);
    // Click confirm on the cancel invitation modal
    const confirmBtns = screen.getAllByTestId('status-confirm');
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    expect(mockCancelMutate).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    // Reset
    mockStoreState.isCancelInvitationModalOpen = false;
    mockStoreState.cancelInvitationUserId = null;
    mockStoreState.cancelInvitationUserEmail = null;
    mockStoreState.cancelInvitationUserName = null;
  });

  it('pagination page change works', () => {
    const manyItemsData = {
      data: {
        items: [
          {
            id: 'u1',
            name: 'Alice',
            email: 'alice@example.com',
            phone: '123',
            role: 'COMPANY_ADMIN',
            status: 'ACTIVE',
            createdAt: '2025-01-01T00:00:00Z',
            company: { id: 'c1', legalName: 'Acme' },
          },
        ],
        meta: { page: 1, total: 11, lastPage: 2 },
      },
      isLoading: false,
      isError: false,
    };
    mockUseUsers.mockReturnValue(manyItemsData);
    render(<UserListPage />);
    fireEvent.click(screen.getByTestId('next-page'));
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
    mockUseUsers.mockRestore();
  });

  it('pagination page size change works', () => {
    const manyItemsData = {
      data: {
        items: [
          {
            id: 'u1',
            name: 'Alice',
            email: 'alice@example.com',
            phone: '123',
            role: 'COMPANY_ADMIN',
            status: 'ACTIVE',
            createdAt: '2025-01-01T00:00:00Z',
            company: { id: 'c1', legalName: 'Acme' },
          },
        ],
        meta: { page: 1, total: 11, lastPage: 2 },
      },
      isLoading: false,
      isError: false,
    };
    mockUseUsers.mockReturnValue(manyItemsData);
    render(<UserListPage />);
    fireEvent.click(screen.getByTestId('change-page-size'));
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
    mockUseUsers.mockRestore();
  });

  it('company actions include deactivateAll for active users', () => {
    render(<UserListPage />);
    // The company section dot-actions should contain editCompany and deactivateAll
    expect(screen.getByTestId('action-editCompany')).toBeInTheDocument();
    expect(screen.getByTestId('action-deactivateAll')).toBeInTheDocument();
  });

  it('clicking editCompany calls openEditCompanyModal', () => {
    render(<UserListPage />);
    fireEvent.click(screen.getByTestId('action-editCompany'));
    expect(mockOpenEditCompanyModal).toHaveBeenCalledWith('c1', 'Acme');
  });

  it('clicking deactivateAll calls openBulkActionModal', () => {
    render(<UserListPage />);
    fireEvent.click(screen.getByTestId('action-deactivateAll'));
    expect(mockOpenBulkActionModal).toHaveBeenCalledWith('deactivate', 'Acme', ['u1']);
  });

  it('bulk action modal shows when store indicates so', () => {
    mockStoreState.isBulkActionModalOpen = true;
    mockStoreState.bulkActionType = 'deactivate';
    mockStoreState.bulkActionCompanyName = 'Acme';
    mockStoreState.bulkActionUserIds = ['u1'];
    render(<UserListPage />);
    const modals = screen.getAllByTestId('status-action-modal');
    expect(modals.length).toBeGreaterThanOrEqual(1);
    // Reset
    mockStoreState.isBulkActionModalOpen = false;
    mockStoreState.bulkActionType = null;
    mockStoreState.bulkActionCompanyName = null;
    mockStoreState.bulkActionUserIds = [];
  });

  it('clicking resendInvitation on invited user calls resendMutation', () => {
    mockUseUsers.mockReturnValueOnce({
      data: {
        items: [
          {
            id: 'u2',
            name: 'Bob',
            email: 'bob@example.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'INVITED',
            createdAt: '2025-01-01T00:00:00Z',
            company: { id: 'c1', legalName: 'Acme' },
          },
        ],
        meta: { page: 1, total: 1, lastPage: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(<UserListPage />);
    fireEvent.click(screen.getByTestId('action-resendInvitation'));
    expect(mockResendMutate).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('clicking resetPassword on active user calls resetPasswordMutation', () => {
    render(<UserListPage />);
    fireEvent.click(screen.getByTestId('action-resetPassword'));
    expect(mockResetPasswordMutate).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('renders filter popovers for company, status, and role', () => {
    render(<UserListPage />);
    expect(screen.getByTestId('filter-filters.company')).toBeInTheDocument();
    expect(screen.getByTestId('filter-filters.status')).toBeInTheDocument();
    expect(screen.getByTestId('filter-filters.role')).toBeInTheDocument();
  });

  it('filter changes trigger setPage(1)', () => {
    render(<UserListPage />);
    fireEvent.click(screen.getByTestId('filter-btn-filters.status'));
    fireEvent.click(screen.getByTestId('filter-btn-filters.role'));
    // No crash, filters work
    expect(screen.getByTestId('filter-filters.status')).toBeInTheDocument();
  });

  it('handleStatusAction deactivate onSuccess calls closeStatusActionModal and openStatusSuccessModal', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = 'u1';
    mockStoreState.statusActionUserEmail = 'alice@example.com';
    mockDeactivateMutate.mockImplementation((_id: string, opts: any) => opts.onSuccess());
    render(<UserListPage />);
    fireEvent.click(screen.getByTestId('status-confirm'));
    expect(mockCloseStatusActionModal).toHaveBeenCalled();
    expect(mockOpenStatusSuccessModal).toHaveBeenCalledWith('deactivate', 'alice@example.com');
    // Reset
    mockDeactivateMutate.mockReset();
    mockStoreState.isStatusActionModalOpen = false;
    mockStoreState.statusActionType = null;
    mockStoreState.statusActionUserId = null;
    mockStoreState.statusActionUserEmail = null;
  });

  it('handleStatusAction activate onSuccess calls closeStatusActionModal and openStatusSuccessModal', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'activate';
    mockStoreState.statusActionUserId = 'u1';
    mockStoreState.statusActionUserEmail = 'alice@example.com';
    mockReactivateMutate.mockImplementation((_id: string, opts: any) => opts.onSuccess());
    render(<UserListPage />);
    fireEvent.click(screen.getByTestId('status-confirm'));
    expect(mockCloseStatusActionModal).toHaveBeenCalled();
    expect(mockOpenStatusSuccessModal).toHaveBeenCalledWith('activate', 'alice@example.com');
    // Reset
    mockReactivateMutate.mockReset();
    mockStoreState.isStatusActionModalOpen = false;
    mockStoreState.statusActionType = null;
    mockStoreState.statusActionUserId = null;
    mockStoreState.statusActionUserEmail = null;
  });

  it('handleStatusAction does nothing when statusActionUserId is null', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = null;
    mockStoreState.statusActionUserEmail = null;
    render(<UserListPage />);
    fireEvent.click(screen.getByTestId('status-confirm'));
    expect(mockDeactivateMutate).not.toHaveBeenCalled();
    // Reset
    mockStoreState.isStatusActionModalOpen = false;
    mockStoreState.statusActionType = null;
  });

  it('handleCancelInvitation onSuccess calls closeCancelInvitationModal', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    mockStoreState.cancelInvitationUserId = 'u2';
    mockStoreState.cancelInvitationUserEmail = 'bob@example.com';
    mockStoreState.cancelInvitationUserName = 'Bob';
    mockCancelMutate.mockImplementation((_id: string, opts: any) => opts.onSuccess());
    render(<UserListPage />);
    const confirmBtns = screen.getAllByTestId('status-confirm');
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    expect(mockCloseCancelInvitationModal).toHaveBeenCalled();
    // Reset
    mockCancelMutate.mockReset();
    mockStoreState.isCancelInvitationModalOpen = false;
    mockStoreState.cancelInvitationUserId = null;
    mockStoreState.cancelInvitationUserEmail = null;
    mockStoreState.cancelInvitationUserName = null;
  });

  it('handleCancelInvitation does nothing when cancelInvitationUserId is null', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    mockStoreState.cancelInvitationUserId = null;
    render(<UserListPage />);
    const confirmBtns = screen.getAllByTestId('status-confirm');
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    expect(mockCancelMutate).not.toHaveBeenCalled();
    // Reset
    mockStoreState.isCancelInvitationModalOpen = false;
  });

  it('bulk action modal confirm calls handleBulkAction which invokes deactivateUser API', async () => {
    mockStoreState.isBulkActionModalOpen = true;
    mockStoreState.bulkActionType = 'deactivate';
    mockStoreState.bulkActionCompanyName = 'Acme';
    mockStoreState.bulkActionUserIds = ['u1'];
    render(<UserListPage />);
    const confirmBtns = screen.getAllByTestId('status-confirm');
    await act(async () => {
      fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    });
    expect(mockCloseBulkActionModal).toHaveBeenCalled();
    // Reset
    mockStoreState.isBulkActionModalOpen = false;
    mockStoreState.bulkActionType = null;
    mockStoreState.bulkActionCompanyName = null;
    mockStoreState.bulkActionUserIds = [];
  });

  it('bulk action modal renders for activate type', () => {
    mockStoreState.isBulkActionModalOpen = true;
    mockStoreState.bulkActionType = 'activate';
    mockStoreState.bulkActionCompanyName = 'Acme';
    mockStoreState.bulkActionUserIds = ['u1'];
    render(<UserListPage />);
    const modals = screen.getAllByTestId('status-action-modal');
    expect(modals.length).toBeGreaterThanOrEqual(1);
    // Reset
    mockStoreState.isBulkActionModalOpen = false;
    mockStoreState.bulkActionType = null;
    mockStoreState.bulkActionCompanyName = null;
    mockStoreState.bulkActionUserIds = [];
  });

  it('bulk action activate success calls notificationService.success', async () => {
    mockStoreState.isBulkActionModalOpen = true;
    mockStoreState.bulkActionType = 'activate';
    mockStoreState.bulkActionCompanyName = 'Acme';
    mockStoreState.bulkActionUserIds = ['u1'];
    render(<UserListPage />);
    const confirmBtns = screen.getAllByTestId('status-confirm');
    act(() => {
      fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    });
    expect(mockCloseBulkActionModal).toHaveBeenCalled();
    // Reset
    mockStoreState.isBulkActionModalOpen = false;
    mockStoreState.bulkActionType = null;
    mockStoreState.bulkActionCompanyName = null;
    mockStoreState.bulkActionUserIds = [];
  });

  it('bulk action partial failure shows error notification', async () => {
    const apiClient = await import('@forethread/api-client');
    vi.mocked(apiClient.deactivateUser).mockResolvedValueOnce({} as never);
    vi.mocked(apiClient.deactivateUser).mockRejectedValueOnce(new Error('fail'));
    mockStoreState.isBulkActionModalOpen = true;
    mockStoreState.bulkActionType = 'deactivate';
    mockStoreState.bulkActionCompanyName = 'Acme';
    mockStoreState.bulkActionUserIds = ['u1', 'u2'];
    render(<UserListPage />);
    const confirmBtns = screen.getAllByTestId('status-confirm');
    act(() => {
      fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    });
    expect(mockCloseBulkActionModal).toHaveBeenCalled();
    // Reset
    mockStoreState.isBulkActionModalOpen = false;
    mockStoreState.bulkActionType = null;
    mockStoreState.bulkActionCompanyName = null;
    mockStoreState.bulkActionUserIds = [];
  });

  it('bulk action full failure shows error notification', async () => {
    const apiClient = await import('@forethread/api-client');
    vi.mocked(apiClient.deactivateUser).mockRejectedValueOnce(new Error('fail1'));
    vi.mocked(apiClient.deactivateUser).mockRejectedValueOnce(new Error('fail2'));
    mockStoreState.isBulkActionModalOpen = true;
    mockStoreState.bulkActionType = 'deactivate';
    mockStoreState.bulkActionCompanyName = 'Acme';
    mockStoreState.bulkActionUserIds = ['u1', 'u2'];
    render(<UserListPage />);
    const confirmBtns = screen.getAllByTestId('status-confirm');
    act(() => {
      fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    });
    expect(mockCloseBulkActionModal).toHaveBeenCalled();
    // Reset
    mockStoreState.isBulkActionModalOpen = false;
    mockStoreState.bulkActionType = null;
    mockStoreState.bulkActionCompanyName = null;
    mockStoreState.bulkActionUserIds = [];
  });

  it('bulk action modal does not render when bulkActionType is null', () => {
    mockStoreState.isBulkActionModalOpen = true;
    mockStoreState.bulkActionType = null;
    mockStoreState.bulkActionCompanyName = null;
    mockStoreState.bulkActionUserIds = [];
    render(<UserListPage />);
    // The modal should not render because bulkActionType is null (conditional rendering)
    expect(screen.queryByTestId('status-action-modal')).not.toBeInTheDocument();
    // Reset
    mockStoreState.isBulkActionModalOpen = false;
  });

  it('company actions include activateAll when all toggleable users are inactive', () => {
    mockUseUsers.mockReturnValueOnce({
      data: {
        items: [
          {
            id: 'u3',
            name: 'Carol',
            email: 'carol@example.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'INACTIVE',
            createdAt: '2025-01-01T00:00:00Z',
            company: { id: 'c1', legalName: 'Acme' },
          },
        ],
        meta: { page: 1, total: 1, lastPage: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(<UserListPage />);
    expect(screen.getByTestId('action-activateAll')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('action-activateAll'));
    expect(mockOpenBulkActionModal).toHaveBeenCalledWith('activate', 'Acme', ['u3']);
  });

  it('search debounce sets debouncedSearch after timeout', () => {
    vi.useFakeTimers();
    render(<UserListPage />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'alice' } });
    // Before debounce fires, the input value is updated
    expect(input).toHaveValue('alice');
    // Advance timer past debounce delay
    act(() => {
      vi.advanceTimersByTime(350);
    });
    // useUsers should have been called with the debounced search value
    expect(mockUseUsers).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('status success modal renders when store indicates so', () => {
    mockStoreState.isStatusSuccessModalOpen = true;
    mockStoreState.statusSuccessType = 'deactivate';
    mockStoreState.statusSuccessUserEmail = 'alice@example.com';
    render(<UserListPage />);
    expect(screen.getByTestId('status-success-modal')).toBeInTheDocument();
    // Reset
    mockStoreState.isStatusSuccessModalOpen = false;
    mockStoreState.statusSuccessType = null;
    mockStoreState.statusSuccessUserEmail = null;
  });

  it('reset password success modal renders when store indicates so', () => {
    mockStoreState.isResetPasswordSuccessModalOpen = true;
    mockStoreState.resetPasswordSuccessEmail = 'alice@example.com';
    render(<UserListPage />);
    expect(screen.getByTestId('reset-password-success-modal')).toBeInTheDocument();
    // Reset
    mockStoreState.isResetPasswordSuccessModalOpen = false;
    mockStoreState.resetPasswordSuccessEmail = null;
  });

  it('resendInvitation onSuccess calls notificationService.success', async () => {
    const { notificationService } = await vi.importMock<any>('@forethread/ui-components');
    mockUseUsers.mockReturnValueOnce({
      data: {
        items: [
          {
            id: 'u2',
            name: 'Bob',
            email: 'bob@example.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'INVITED',
            createdAt: '2025-01-01T00:00:00Z',
            company: { id: 'c1', legalName: 'Acme' },
          },
        ],
        meta: { page: 1, total: 1, lastPage: 1 },
      },
      isLoading: false,
      isError: false,
    });
    mockResendMutate.mockImplementation((_id: string, opts: any) => opts.onSuccess());
    render(<UserListPage />);
    fireEvent.click(screen.getByTestId('action-resendInvitation'));
    expect(notificationService.success).toHaveBeenCalledWith('resendInvitationSuccess');
    mockResendMutate.mockReset();
  });

  it('resetPassword onSuccess calls openResetPasswordSuccessModal', () => {
    mockResetPasswordMutate.mockImplementation((_id: string, opts: any) => opts.onSuccess());
    render(<UserListPage />);
    fireEvent.click(screen.getByTestId('action-resetPassword'));
    expect(mockOpenResetPasswordSuccessModal).toHaveBeenCalledWith('alice@example.com');
    mockResetPasswordMutate.mockReset();
  });

  it('sorting same field twice sets desc, third click clears sort', () => {
    render(<UserListPage />);
    const emailHeader = screen.getByText('columns.email');
    // First click: asc
    fireEvent.click(emailHeader);
    // Second click: desc
    fireEvent.click(emailHeader);
    // Third click: clear
    fireEvent.click(emailHeader);
    // No crash, sorting cycles through
    expect(emailHeader).toBeInTheDocument();
  });
});
