// eslint-disable-next-line import/order
import type { UserResponse } from '@forethread/api-client';

const mockUsers: UserResponse[] = [
  {
    id: 'u1',
    name: 'Alice',
    email: 'alice@test.com',
    phone: '+61 111',
    status: 'ACTIVE',
    role: 'VENDOR',
    createdAt: '2024-01-15T00:00:00Z',
    position: null,
    workStatus: null,
    company: null,
  } as any,
  {
    id: 'u2',
    name: 'Bob',
    email: 'bob@test.com',
    phone: null,
    status: 'INVITED',
    role: 'VENDOR',
    createdAt: '2024-02-20T00:00:00Z',
    position: null,
    workStatus: null,
    company: null,
  } as any,
  {
    id: 'u3',
    name: 'Charlie',
    email: 'charlie@test.com',
    phone: null,
    status: 'INACTIVE',
    role: 'VENDOR',
    createdAt: '2024-03-01T00:00:00Z',
    position: null,
    workStatus: null,
    company: null,
  } as any,
];

const mockUseVendorUsers = vi.hoisted(() => vi.fn());
const mockResendMutate = vi.hoisted(() => vi.fn());
const mockCancelInvMutate = vi.hoisted(() => vi.fn());

// Vendors can only manage invitations — no deactivate/reactivate from the list. (US 3.10)
vi.mock('../services/vendor-users.service', () => ({
  useVendorUsers: mockUseVendorUsers,
  useResendVendorUserInvitation: () => ({ mutate: mockResendMutate, isPending: false }),
  useCancelVendorUserInvitation: () => ({ mutate: mockCancelInvMutate, isPending: false }),
}));

const mockStoreState = vi.hoisted(() => ({
  isInviteModalOpen: false,
  openInviteModal: vi.fn(),
  closeInviteModal: vi.fn(),
  isSuccessModalOpen: false,
  invitedUserEmail: null as string | null,
  closeSuccessModal: vi.fn(),
  isStatusActionModalOpen: false,
  statusActionType: null as string | null,
  statusActionUserId: null as string | null,
  statusActionUserEmail: null as string | null,
  openStatusActionModal: vi.fn(),
  closeStatusActionModal: vi.fn(),
}));

vi.mock('../state/vendor-users.store', () => ({
  useVendorUsersStore: () => mockStoreState,
}));

vi.mock('../hooks/useVendorUserSort', () => ({
  useVendorUserSort: () => ({ sortField: null, sortDir: null, handleSort: vi.fn() }),
}));

vi.mock('./InviteVendorUserModal', () => ({
  InviteVendorUserModal: () => <div data-testid="invite-modal" />,
}));

// DS tonal badges — render the label so existing status assertions keep working.
vi.mock('@/features/users/shared/userBadges', () => ({
  StatusBadge: ({ label }: any) => <span data-testid="status-badge">{label}</span>,
  RoleBadge: ({ label }: any) => <span data-testid="role-badge">{label}</span>,
}));

const mockNavigate = vi.hoisted(() => vi.fn());
const mockSetPageTitle = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (sel: any) => sel({ setTitle: mockSetPageTitle }),
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: { settings: '/settings', users: '/users' },
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      if (opts && typeof opts === 'object' && 'defaultValue' in opts) return opts.defaultValue;
      return key;
    },
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  Spinner: () => <div data-testid="spinner" />,
  TablePagination: ({ onPageChange, onPageSizeChange, showingLabel }: any) => (
    <div data-testid="pagination">
      <button data-testid="page-change" onClick={() => onPageChange(2)}>
        Page 2
      </button>
      <button data-testid="page-size-change" onClick={() => onPageSizeChange(50)}>
        Size 50
      </button>
      <span data-testid="showing-label">{showingLabel({ from: 1, to: 10, total: 3 })}</span>
    </div>
  ),
  EmptyState: ({ title }: any) => <div data-testid="empty-state">{title}</div>,
  EmptyBoxIllustration: () => <div data-testid="empty-illustration" />,
  DotActionsMenu: ({ actions }: any) => (
    <div data-testid="dot-menu">
      {actions.map((a: any) => (
        <button key={a.key} onClick={a.onClick} data-testid={`action-${a.key}`}>
          {a.label}
        </button>
      ))}
    </div>
  ),
  StatusActionModal: ({ title, onConfirm, onClose }: any) => (
    <div data-testid="status-action-modal">
      <span>{title}</span>
      <button onClick={onConfirm} data-testid="confirm-action">
        Confirm
      </button>
      <button onClick={onClose} data-testid="cancel-action">
        Cancel
      </button>
    </div>
  ),
  SortIcon: () => <span data-testid="sort-icon" />,
  SearchInput: ({ value, onChange }: any) => (
    <input data-testid="search" value={value} onChange={onChange} />
  ),
  FilterPopover: ({ onChange }: any) => (
    <div data-testid="filter">
      <button data-testid="filter-change" onClick={() => onChange(['ACTIVE'])}>
        Set Filter
      </button>
    </div>
  ),
  DateRangeFilterDropdown: ({ onChangeFrom, onChangeTo, onClear }: any) => (
    <div data-testid="date-range-filter">
      <button data-testid="date-from" onClick={() => onChangeFrom('2024-01-01')}>
        From
      </button>
      <button data-testid="date-to" onClick={() => onChangeTo('2024-12-31')}>
        To
      </button>
      <button data-testid="date-clear" onClick={onClear}>
        Clear
      </button>
    </div>
  ),
  notificationService: { success: vi.fn() },
}));

vi.mock('@forethread/vendor-shared', () => ({
  VendorInviteSuccessModal: () => <div data-testid="success-modal" />,
}));

const SvgStub = vi.hoisted(() => () => null);
vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: SvgStub,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: SvgStub,
}));
vi.mock('@forethread/ui-components/assets/icons/new-user.svg?react', () => ({ default: SvgStub }));
vi.mock('@forethread/ui-components/assets/icons/users-group.svg?react', () => ({
  default: SvgStub,
}));

import { render, screen, fireEvent } from '@testing-library/react';

import VendorUserListPage from './VendorUserListPage';

describe('VendorUserListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseVendorUsers.mockReturnValue({
      data: { items: mockUsers, meta: { page: 1, limit: 25, total: 3, totalPages: 1 } },
      isLoading: false,
      isError: false,
    });
    Object.assign(mockStoreState, {
      isInviteModalOpen: false,
      isSuccessModalOpen: false,
      invitedUserEmail: null,
      isStatusActionModalOpen: false,
      statusActionType: null,
      statusActionUserId: null,
      statusActionUserEmail: null,
    });
  });

  it('shows spinner when loading', () => {
    mockUseVendorUsers.mockReturnValueOnce({ data: undefined, isLoading: true, isError: false });
    render(<VendorUserListPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows error message on error', () => {
    mockUseVendorUsers.mockReturnValueOnce({ data: undefined, isLoading: false, isError: true });
    render(<VendorUserListPage />);
    expect(screen.getByText('failedToLoad')).toBeInTheDocument();
  });

  it('shows empty state when no users', () => {
    mockUseVendorUsers.mockReturnValueOnce({
      data: { items: [], meta: { page: 1, limit: 25, total: 0, totalPages: 0 } },
      isLoading: false,
      isError: false,
    });
    render(<VendorUserListPage />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders user rows', () => {
    render(<VendorUserListPage />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('renders email and phone columns', () => {
    render(<VendorUserListPage />);
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
    expect(screen.getByText('+61 111')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('renders status as a tonal DS badge pill', () => {
    render(<VendorUserListPage />);
    const badges = screen.getAllByTestId('status-badge');
    expect(badges).toHaveLength(3);
    expect(badges.some((b) => b.textContent === 'statuses.ACTIVE')).toBe(true);
    expect(badges.some((b) => b.textContent === 'statuses.INVITED')).toBe(true);
    expect(badges.some((b) => b.textContent === 'statuses.INACTIVE')).toBe(true);
  });

  it('renders pagination', () => {
    render(<VendorUserListPage />);
    expect(screen.getByTestId('pagination')).toBeInTheDocument();
  });

  it('renders search input and invite button', () => {
    render(<VendorUserListPage />);
    expect(screen.getByTestId('search')).toBeInTheDocument();
    expect(screen.getByText('inviteUser')).toBeInTheDocument();
  });

  it('opens invite modal on button click', () => {
    render(<VendorUserListPage />);
    fireEvent.click(screen.getByText('inviteUser'));
    expect(mockStoreState.openInviteModal).toHaveBeenCalled();
  });

  it('shows a dot-menu only for INVITED users', () => {
    render(<VendorUserListPage />);
    // Active (Alice) + Inactive (Charlie) get view-only; only Invited (Bob) gets a menu.
    expect(screen.getAllByTestId('dot-menu')).toHaveLength(1);
  });

  it('shows resend/cancel actions for the INVITED user', () => {
    render(<VendorUserListPage />);
    const dotMenu = screen.getByTestId('dot-menu');
    expect(dotMenu.querySelector('[data-testid="action-resendInvitation"]')).toBeTruthy();
    expect(dotMenu.querySelector('[data-testid="action-cancelInvitation"]')).toBeTruthy();
  });

  it('calls openStatusActionModal for resend action', () => {
    render(<VendorUserListPage />);
    const btn = screen
      .getByTestId('dot-menu')
      .querySelector('[data-testid="action-resendInvitation"]')!;
    fireEvent.click(btn);
    expect(mockStoreState.openStatusActionModal).toHaveBeenCalledWith(
      'resendInvitation',
      'u2',
      'bob@test.com',
    );
  });

  it('calls openStatusActionModal for cancel invitation', () => {
    render(<VendorUserListPage />);
    const btn = screen
      .getByTestId('dot-menu')
      .querySelector('[data-testid="action-cancelInvitation"]')!;
    fireEvent.click(btn);
    expect(mockStoreState.openStatusActionModal).toHaveBeenCalledWith(
      'cancelInvitation',
      'u2',
      'bob@test.com',
    );
  });

  it('renders invite modal when open', () => {
    mockStoreState.isInviteModalOpen = true;
    render(<VendorUserListPage />);
    expect(screen.getByTestId('invite-modal')).toBeInTheDocument();
  });

  it('renders success modal when open', () => {
    mockStoreState.isSuccessModalOpen = true;
    mockStoreState.invitedUserEmail = 'test@e.com';
    render(<VendorUserListPage />);
    expect(screen.getByTestId('success-modal')).toBeInTheDocument();
  });

  it('renders status action modal for resend invitation', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'resendInvitation';
    mockStoreState.statusActionUserId = 'u2';
    mockStoreState.statusActionUserEmail = 'bob@test.com';
    render(<VendorUserListPage />);
    expect(screen.getByTestId('status-action-modal')).toBeInTheDocument();
  });

  it('renders cancel invitation modal when open', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'cancelInvitation';
    mockStoreState.statusActionUserId = 'u2';
    mockStoreState.statusActionUserEmail = 'bob@test.com';
    render(<VendorUserListPage />);
    expect(screen.getByTestId('status-action-modal')).toBeInTheDocument();
  });

  it('calls resendMutation on resend modal confirm', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'resendInvitation';
    mockStoreState.statusActionUserId = 'u2';
    mockStoreState.statusActionUserEmail = 'bob@test.com';
    render(<VendorUserListPage />);
    fireEvent.click(screen.getByTestId('confirm-action'));
    expect(mockResendMutate).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('calls cancelInvitation mutation on confirm', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'cancelInvitation';
    mockStoreState.statusActionUserId = 'u2';
    mockStoreState.statusActionUserEmail = 'bob@test.com';
    render(<VendorUserListPage />);
    fireEvent.click(screen.getByTestId('confirm-action'));
    expect(mockCancelInvMutate).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('does not render modals when closed', () => {
    render(<VendorUserListPage />);
    expect(screen.queryByTestId('invite-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('success-modal')).not.toBeInTheDocument();
  });

  it('does not render status modal when type is null', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = null;
    render(<VendorUserListPage />);
    expect(screen.queryByTestId('status-action-modal')).not.toBeInTheDocument();
  });

  it('does nothing on cancel invitation when userId is null', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'cancelInvitation';
    mockStoreState.statusActionUserId = null;
    mockStoreState.statusActionUserEmail = null;
    render(<VendorUserListPage />);
    fireEvent.click(screen.getByTestId('confirm-action'));
    expect(mockCancelInvMutate).not.toHaveBeenCalled();
  });

  it('does nothing on status action when userId/email is null', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'resendInvitation';
    mockStoreState.statusActionUserId = null;
    mockStoreState.statusActionUserEmail = null;
    render(<VendorUserListPage />);
    fireEvent.click(screen.getByTestId('confirm-action'));
    expect(mockResendMutate).not.toHaveBeenCalled();
  });

  it('sets the User Management page title + breadcrumb in the app header', () => {
    render(<VendorUserListPage />);
    expect(mockSetPageTitle).toHaveBeenCalledWith('title', null, null, [{ label: 'title' }]);
  });

  it('renders table column headers', () => {
    render(<VendorUserListPage />);
    expect(screen.getByText('columns.fullName')).toBeInTheDocument();
    expect(screen.getByText('columns.email')).toBeInTheDocument();
    expect(screen.getByText('columns.phone')).toBeInTheDocument();
    expect(screen.getByText('columns.status')).toBeInTheDocument();
    expect(screen.getByText('columns.dateJoined')).toBeInTheDocument();
    expect(screen.getByText('columns.actions')).toBeInTheDocument();
  });

  it('navigates to user detail on view click', () => {
    render(<VendorUserListPage />);
    const viewBtns = screen.getAllByLabelText('View');
    fireEvent.click(viewBtns[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/users/u1');
  });

  it('calls filter dropdown onChange', () => {
    render(<VendorUserListPage />);
    fireEvent.click(screen.getByTestId('filter-change'));
    // Triggers setStatusFilter(['ACTIVE']) and setPage(1) — just verify no crash
    expect(screen.getByTestId('filter')).toBeInTheDocument();
  });

  it('calls date range from change', () => {
    render(<VendorUserListPage />);
    fireEvent.click(screen.getByTestId('date-from'));
    expect(screen.getByTestId('date-range-filter')).toBeInTheDocument();
  });

  it('calls date range to change', () => {
    render(<VendorUserListPage />);
    fireEvent.click(screen.getByTestId('date-to'));
    expect(screen.getByTestId('date-range-filter')).toBeInTheDocument();
  });

  it('calls date range clear', () => {
    render(<VendorUserListPage />);
    fireEvent.click(screen.getByTestId('date-clear'));
    expect(screen.getByTestId('date-range-filter')).toBeInTheDocument();
  });

  it('calls search input onChange', () => {
    render(<VendorUserListPage />);
    fireEvent.change(screen.getByTestId('search'), { target: { value: 'alice' } });
    expect(screen.getByTestId('search')).toBeInTheDocument();
  });

  it('renders showing label in pagination', () => {
    render(<VendorUserListPage />);
    expect(screen.getByTestId('showing-label')).toBeInTheDocument();
  });
});
