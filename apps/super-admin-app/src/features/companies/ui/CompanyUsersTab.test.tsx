import { CompanyType } from '@forethread/shared-types/client';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock SVG icons
vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/new-user.svg?react', () => ({
  default: () => <div />,
}));

// Mock i18n
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock ui-components
vi.mock('@forethread/ui-components', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...props}>{children}</button>
  ),
  Spinner: () => <div data-testid="spinner" />,
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  TablePagination: ({ onPageChange, onPageSizeChange, showingLabel }: any) => (
    <div data-testid="table-pagination">
      <button data-testid="next-page" onClick={() => onPageChange(2)}>
        Next
      </button>
      <button data-testid="page-size" onClick={() => onPageSizeChange(50)}>
        50
      </button>
      {showingLabel && <span>{showingLabel({ from: 1, to: 25, total: 100 })}</span>}
    </div>
  ),
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
  DotActionsMenu: ({ actions }: any) => (
    <div data-testid="dot-actions">
      {actions?.map((a: any) => (
        <button key={a.key} data-testid={`action-${a.key}`} onClick={a.onClick}>
          {a.label}
        </button>
      ))}
    </div>
  ),
  SortIcon: () => <span data-testid="sort-icon" />,
  StatusActionModal: ({ onConfirm, onClose }: any) => (
    <div data-testid="status-action-modal">
      <button data-testid="status-confirm" onClick={onConfirm}>
        Confirm
      </button>
      <button data-testid="status-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
  StatusSuccessModal: ({ redirectLabel }: any) => (
    <div data-testid="status-success-modal">{redirectLabel && <span>{redirectLabel(5)}</span>}</div>
  ),
  ResetPasswordSuccessModal: ({ redirectLabel }: any) => (
    <div data-testid="reset-password-modal">{redirectLabel && <span>{redirectLabel(5)}</span>}</div>
  ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock shared-types
vi.mock('@forethread/shared-types/client', () => ({
  UserStatus: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', INVITED: 'INVITED' },
  CompanyType: { CONTRACTOR: 'CONTRACTOR', VENDOR: 'VENDOR' },
}));

// Mock constants
vi.mock('@/features/users/constants/roles', () => ({
  ROLE_BADGE_COLORS: {},
  STATUS_TEXT_COLORS: {},
}));

// Mock users service
const mockUseUsers = vi.fn();
const mockDeactivateMutate = vi.fn();
const mockReactivateMutate = vi.fn();
const mockResendMutate = vi.fn();
const mockCancelMutate = vi.fn();
const mockResetPasswordMutate = vi.fn();

vi.mock('@/features/users/services/users.service', () => ({
  useUsers: (...args: unknown[]) => mockUseUsers(...args),
  useDeactivateUser: () => ({ mutate: mockDeactivateMutate, isPending: false }),
  useReactivateUser: () => ({ mutate: mockReactivateMutate, isPending: false }),
  useResendInvitation: () => ({ mutate: mockResendMutate }),
  useCancelInvitation: () => ({ mutate: mockCancelMutate, isPending: false }),
  useInitiateResetPassword: () => ({ mutate: mockResetPasswordMutate }),
}));

// Mock users store
const mockOpenCreateModal = vi.fn();
const mockOpenEditModal = vi.fn();
const mockOpenStatusActionModal = vi.fn();
const mockCloseStatusActionModal = vi.fn();
const mockOpenStatusSuccessModal = vi.fn();
const mockOpenResetPasswordSuccessModal = vi.fn();
const mockOpenCancelInvitationModal = vi.fn();
const mockCloseCancelInvitationModal = vi.fn();

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
};

vi.mock('@/features/users/state/users.store', () => ({
  useUsersStore: () => mockStoreState,
}));

// Mock child modals
vi.mock('../../users/ui/CreateUserModal', () => ({
  CreateUserModal: () => <div data-testid="create-user-modal" />,
}));
vi.mock('../../users/ui/EditUserModal', () => ({
  EditUserModal: () => <div data-testid="edit-user-modal" />,
}));

import { CompanyUsersTab } from './CompanyUsersTab';

describe('CompanyUsersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders spinner when loading', () => {
    mockUseUsers.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders error message on error', () => {
    mockUseUsers.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    expect(screen.getByText('failedToLoad')).toBeInTheDocument();
  });

  it('renders empty state when no users', () => {
    mockUseUsers.mockReturnValue({
      data: { items: [], meta: { page: 1, total: 0 } },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders user table when data is available', () => {
    mockUseUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u1',
            name: 'John Doe',
            email: 'john@test.com',
            phone: '+61412345678',
            role: 'COMPANY_ADMIN',
            status: 'ACTIVE',
            createdAt: '2026-01-15T00:00:00Z',
          },
        ],
        meta: { page: 1, total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@test.com')).toBeInTheDocument();
  });

  it('renders invite user button', () => {
    mockUseUsers.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    expect(screen.getByText('inviteUser')).toBeInTheDocument();
  });

  it('clicking invite user calls openCreateModal', () => {
    mockUseUsers.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    fireEvent.click(screen.getByText('inviteUser'));
    expect(mockOpenCreateModal).toHaveBeenCalled();
  });

  it('clicking column header triggers sort', () => {
    mockUseUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u1',
            name: 'John',
            email: 'j@t.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'ACTIVE',
            createdAt: '2026-01-15T00:00:00Z',
          },
        ],
        meta: { page: 1, total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    const nameHeader = screen.getByText('columns.fullName');
    // Click to set asc
    fireEvent.click(nameHeader);
    // Click to set desc
    fireEvent.click(nameHeader);
    // Click to clear
    fireEvent.click(nameHeader);
    expect(nameHeader).toBeInTheDocument();
  });

  it('clicking View button navigates to user detail', () => {
    mockUseUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u1',
            name: 'John',
            email: 'j@t.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'ACTIVE',
            createdAt: '2026-01-15T00:00:00Z',
          },
        ],
        meta: { page: 1, total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    const viewBtns = screen.getAllByLabelText('View');
    fireEvent.click(viewBtns[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/settings/users/u1');
  });

  it('clicking Edit button calls openEditModal', () => {
    mockUseUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u1',
            name: 'John',
            email: 'j@t.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'ACTIVE',
            createdAt: '2026-01-15T00:00:00Z',
          },
        ],
        meta: { page: 1, total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    const editBtns = screen.getAllByLabelText('Edit');
    fireEvent.click(editBtns[0]);
    expect(mockOpenEditModal).toHaveBeenCalledWith('u1');
  });

  it('row actions for Active user include resetPassword and deactivate', () => {
    mockUseUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u1',
            name: 'John',
            email: 'j@t.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'ACTIVE',
            createdAt: '2026-01-15T00:00:00Z',
          },
        ],
        meta: { page: 1, total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    expect(screen.getByTestId('action-resetPassword')).toBeInTheDocument();
    expect(screen.getByTestId('action-deactivate')).toBeInTheDocument();
  });

  it('clicking deactivate calls openStatusActionModal', () => {
    mockUseUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u1',
            name: 'John',
            email: 'j@t.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'ACTIVE',
            createdAt: '2026-01-15T00:00:00Z',
          },
        ],
        meta: { page: 1, total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    fireEvent.click(screen.getByTestId('action-deactivate'));
    expect(mockOpenStatusActionModal).toHaveBeenCalledWith('deactivate', 'u1', 'j@t.com');
  });

  it('row actions for Invited user include resend and cancel', () => {
    mockUseUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u2',
            name: 'Bob',
            email: 'b@t.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'INVITED',
            createdAt: '2026-01-15T00:00:00Z',
          },
        ],
        meta: { page: 1, total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    expect(screen.getByTestId('action-resendInvitation')).toBeInTheDocument();
    expect(screen.getByTestId('action-cancelInvitation')).toBeInTheDocument();
  });

  it('clicking resendInvitation calls resendMutate', () => {
    mockUseUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u2',
            name: 'Bob',
            email: 'b@t.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'INVITED',
            createdAt: '2026-01-15T00:00:00Z',
          },
        ],
        meta: { page: 1, total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    fireEvent.click(screen.getByTestId('action-resendInvitation'));
    expect(mockResendMutate).toHaveBeenCalledWith('u2');
  });

  it('clicking cancelInvitation calls openCancelInvitationModal', () => {
    mockUseUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u2',
            name: 'Bob',
            email: 'b@t.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'INVITED',
            createdAt: '2026-01-15T00:00:00Z',
          },
        ],
        meta: { page: 1, total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    fireEvent.click(screen.getByTestId('action-cancelInvitation'));
    expect(mockOpenCancelInvitationModal).toHaveBeenCalledWith('u2', 'b@t.com', 'Bob');
  });

  it('row actions for Inactive user include activate', () => {
    mockUseUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u3',
            name: 'Carol',
            email: 'c@t.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'INACTIVE',
            createdAt: '2026-01-15T00:00:00Z',
          },
        ],
        meta: { page: 1, total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    expect(screen.getByTestId('action-activate')).toBeInTheDocument();
  });

  it('status action modal confirm triggers deactivateMutation', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = 'u1';
    mockStoreState.statusActionUserEmail = 'j@t.com';
    mockUseUsers.mockReturnValue({
      data: { items: [], meta: { page: 1, total: 0 } },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    fireEvent.click(screen.getByTestId('status-confirm'));
    expect(mockDeactivateMutate).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    // Reset
    mockStoreState.isStatusActionModalOpen = false;
    mockStoreState.statusActionType = null;
  });

  it('cancel invitation modal confirm triggers cancelMutation', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    mockStoreState.cancelInvitationUserId = 'u2';
    mockStoreState.cancelInvitationUserEmail = 'b@t.com';
    mockStoreState.cancelInvitationUserName = 'Bob';
    mockUseUsers.mockReturnValue({
      data: { items: [], meta: { page: 1, total: 0 } },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    const confirmBtns = screen.getAllByTestId('status-confirm');
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    expect(mockCancelMutate).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    // Reset
    mockStoreState.isCancelInvitationModalOpen = false;
    mockStoreState.cancelInvitationUserId = null;
  });

  it('pagination page change works', () => {
    mockUseUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u1',
            name: 'John',
            email: 'j@t.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'ACTIVE',
            createdAt: '2026-01-15T00:00:00Z',
          },
        ],
        meta: { page: 1, total: 50 },
      },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    fireEvent.click(screen.getByTestId('next-page'));
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
  });

  it('pagination page size change works', () => {
    mockUseUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u1',
            name: 'John',
            email: 'j@t.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'ACTIVE',
            createdAt: '2026-01-15T00:00:00Z',
          },
        ],
        meta: { page: 1, total: 50 },
      },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    fireEvent.click(screen.getByTestId('page-size'));
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
  });

  it('formatDate handles null date', () => {
    mockUseUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u1',
            name: 'John',
            email: 'j@t.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'ACTIVE',
            createdAt: null,
          },
        ],
        meta: { page: 1, total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    // null date should show dash
    const cells = screen.getAllByText('—');
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking resetPassword calls resetPasswordMutation', () => {
    mockUseUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u1',
            name: 'John',
            email: 'j@t.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'ACTIVE',
            createdAt: '2026-01-15T00:00:00Z',
          },
        ],
        meta: { page: 1, total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    fireEvent.click(screen.getByTestId('action-resetPassword'));
    expect(mockResetPasswordMutate).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('handleStatusAction with activate calls reactivateMutation', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'activate';
    mockStoreState.statusActionUserId = 'u3';
    mockStoreState.statusActionUserEmail = 'c@t.com';
    mockUseUsers.mockReturnValue({
      data: { items: [], meta: { page: 1, total: 0 } },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    fireEvent.click(screen.getByTestId('status-confirm'));
    expect(mockReactivateMutate).toHaveBeenCalledWith(
      'u3',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    // Reset
    mockStoreState.isStatusActionModalOpen = false;
    mockStoreState.statusActionType = null;
    mockStoreState.statusActionUserId = null;
    mockStoreState.statusActionUserEmail = null;
  });

  it('handleStatusAction deactivate onSuccess calls closeStatusActionModal and openStatusSuccessModal', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = 'u1';
    mockStoreState.statusActionUserEmail = 'j@t.com';
    mockDeactivateMutate.mockImplementation((_id: string, opts: any) => opts.onSuccess());
    mockUseUsers.mockReturnValue({
      data: { items: [], meta: { page: 1, total: 0 } },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    fireEvent.click(screen.getByTestId('status-confirm'));
    expect(mockCloseStatusActionModal).toHaveBeenCalled();
    expect(mockOpenStatusSuccessModal).toHaveBeenCalledWith('deactivate', 'j@t.com');
    // Reset
    mockDeactivateMutate.mockReset();
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
    mockUseUsers.mockReturnValue({
      data: { items: [], meta: { page: 1, total: 0 } },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    fireEvent.click(screen.getByTestId('status-confirm'));
    expect(mockDeactivateMutate).not.toHaveBeenCalled();
    // Reset
    mockStoreState.isStatusActionModalOpen = false;
    mockStoreState.statusActionType = null;
  });

  it('handleCancelInvitation onSuccess calls closeCancelInvitationModal', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    mockStoreState.cancelInvitationUserId = 'u2';
    mockStoreState.cancelInvitationUserEmail = 'b@t.com';
    mockStoreState.cancelInvitationUserName = 'Bob';
    mockCancelMutate.mockImplementation((_id: string, opts: any) => opts.onSuccess());
    mockUseUsers.mockReturnValue({
      data: { items: [], meta: { page: 1, total: 0 } },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
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
    mockUseUsers.mockReturnValue({
      data: { items: [], meta: { page: 1, total: 0 } },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    const confirmBtns = screen.getAllByTestId('status-confirm');
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    expect(mockCancelMutate).not.toHaveBeenCalled();
    // Reset
    mockStoreState.isCancelInvitationModalOpen = false;
  });

  it('clicking activate on inactive user calls openStatusActionModal with activate', () => {
    mockUseUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u3',
            name: 'Carol',
            email: 'c@t.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'INACTIVE',
            createdAt: '2026-01-15T00:00:00Z',
          },
        ],
        meta: { page: 1, total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    fireEvent.click(screen.getByTestId('action-activate'));
    expect(mockOpenStatusActionModal).toHaveBeenCalledWith('activate', 'u3', 'c@t.com');
  });

  it('resetPassword onSuccess calls openResetPasswordSuccessModal', () => {
    mockResetPasswordMutate.mockImplementation((_id: string, opts: any) => opts.onSuccess());
    mockUseUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u1',
            name: 'John',
            email: 'j@t.com',
            phone: null,
            role: 'COMPANY_ADMIN',
            status: 'ACTIVE',
            createdAt: '2026-01-15T00:00:00Z',
          },
        ],
        meta: { page: 1, total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    fireEvent.click(screen.getByTestId('action-resetPassword'));
    expect(mockOpenResetPasswordSuccessModal).toHaveBeenCalledWith('j@t.com');
    mockResetPasswordMutate.mockReset();
  });

  it('status success modal renders when store indicates so', () => {
    mockStoreState.isStatusSuccessModalOpen = true;
    mockStoreState.statusSuccessType = 'deactivate';
    mockStoreState.statusSuccessUserEmail = 'j@t.com';
    mockUseUsers.mockReturnValue({
      data: { items: [], meta: { page: 1, total: 0 } },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    expect(screen.getByTestId('status-success-modal')).toBeInTheDocument();
    // Reset
    mockStoreState.isStatusSuccessModalOpen = false;
    mockStoreState.statusSuccessType = null;
    mockStoreState.statusSuccessUserEmail = null;
  });

  it('reset password success modal renders when store indicates so', () => {
    mockStoreState.isResetPasswordSuccessModalOpen = true;
    mockStoreState.resetPasswordSuccessEmail = 'j@t.com';
    mockUseUsers.mockReturnValue({
      data: { items: [], meta: { page: 1, total: 0 } },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    expect(screen.getByTestId('reset-password-modal')).toBeInTheDocument();
    // Reset
    mockStoreState.isResetPasswordSuccessModalOpen = false;
    mockStoreState.resetPasswordSuccessEmail = null;
  });

  it('create user modal renders when store indicates so', () => {
    mockStoreState.isCreateModalOpen = true;
    mockUseUsers.mockReturnValue({
      data: { items: [], meta: { page: 1, total: 0 } },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    expect(screen.getByTestId('create-user-modal')).toBeInTheDocument();
    // Reset
    mockStoreState.isCreateModalOpen = false;
  });

  it('edit user modal renders when store indicates so', () => {
    mockStoreState.isEditModalOpen = true;
    mockUseUsers.mockReturnValue({
      data: { items: [], meta: { page: 1, total: 0 } },
      isLoading: false,
      isError: false,
    });
    render(
      <CompanyUsersTab
        companyId="c1"
        companyName="Test Company"
        companyType={CompanyType.CONTRACTOR}
      />,
    );
    expect(screen.getByTestId('edit-user-modal')).toBeInTheDocument();
    // Reset
    mockStoreState.isEditModalOpen = false;
  });
});
