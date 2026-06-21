import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <div />,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/shared-types/client', () => ({
  UserStatus: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', INVITED: 'INVITED' },
}));

vi.mock('@forethread/ui-components', () => ({
  useDebounce: (v: unknown) => v,
  StatusActionModal: ({ onConfirm, onClose }: any) => (
    <div data-testid="status-action-modal">
      <button data-testid="status-confirm" onClick={onConfirm}>
        confirm
      </button>
      <button data-testid="status-close" onClick={onClose}>
        close
      </button>
    </div>
  ),
  StatusSuccessModal: () => <div data-testid="status-success-modal" />,
  ResetPasswordSuccessModal: () => <div data-testid="reset-password-modal" />,
}));

// Capture the props passed to the shared table view so we can exercise the
// container's row actions / handlers directly.
let tableProps: any;
vi.mock('@/features/users/shared/CompanyUsersTableView', () => ({
  CompanyUsersTableView: (props: any) => {
    tableProps = props;
    return <div data-testid="table-view" />;
  },
}));

vi.mock('../../users/super-admin/ui/EditUserModal', () => ({
  EditUserModal: () => <div data-testid="edit-user-modal" />,
}));

vi.mock('@/features/users/super-admin/constants/roles', () => ({
  ALL_ROLE_OPTIONS: ['COMPANY_ADMIN', 'PROCUREMENT_OFFICER'],
}));

vi.mock('@/features/users/super-admin/hooks/useUserSort', () => ({
  useUserSort: () => ({ sortField: null, sortDir: null, handleSort: vi.fn() }),
}));

const mockUseUsers = vi.fn();
const mockDeactivate = vi.fn();
const mockReactivate = vi.fn();
const mockResend = vi.fn();
const mockCancel = vi.fn();
const mockResetPassword = vi.fn();
vi.mock('@/features/users/super-admin/services/users.service', () => ({
  useUsers: (...a: unknown[]) => mockUseUsers(...a),
  useDeactivateUser: () => ({ mutate: mockDeactivate, isPending: false }),
  useReactivateUser: () => ({ mutate: mockReactivate, isPending: false }),
  useResendInvitation: () => ({ mutate: mockResend }),
  useCancelInvitation: () => ({ mutate: mockCancel, isPending: false }),
  useInitiateResetPassword: () => ({ mutate: mockResetPassword }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockOpenEditModal = vi.fn();
const mockOpenStatusActionModal = vi.fn();
const mockCloseStatusActionModal = vi.fn();
const mockOpenStatusSuccessModal = vi.fn();
const mockOpenResetPasswordSuccessModal = vi.fn();
const mockOpenCancelInvitationModal = vi.fn();
const mockCloseCancelInvitationModal = vi.fn();
const store: Record<string, unknown> = {};
vi.mock('@/features/users/super-admin/state/users.store', () => ({
  useUsersStore: () => store,
}));

import { CompanyUsersTab } from './CompanyUsersTab';

function resetStore() {
  Object.assign(store, {
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
  });
}

const active = { id: 'u1', name: 'John', email: 'j@t.com', status: 'ACTIVE' } as any;
const invited = { id: 'u2', name: 'Bob', email: 'b@t.com', status: 'INVITED' } as any;
const inactive = { id: 'u3', name: 'Carol', email: 'c@t.com', status: 'INACTIVE' } as any;

describe('CompanyUsersTab (super-admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mockUseUsers.mockReturnValue({
      data: { items: [active], meta: { page: 1, total: 1 } },
      isLoading: false,
      isError: false,
    });
  });

  it('renders the shared table view', () => {
    render(<CompanyUsersTab companyId="c1" />);
    expect(screen.getByTestId('table-view')).toBeInTheDocument();
    expect(tableProps.total).toBe(1);
    expect(tableProps.users).toHaveLength(1);
  });

  it('active user actions = resetPassword + deactivate', () => {
    render(<CompanyUsersTab companyId="c1" />);
    const keys = tableProps.getRowActions(active).map((a: any) => a.key);
    expect(keys).toEqual(['resetPassword', 'deactivate']);
  });

  it('invited user actions = resend + cancel', () => {
    render(<CompanyUsersTab companyId="c1" />);
    const keys = tableProps.getRowActions(invited).map((a: any) => a.key);
    expect(keys).toEqual(['resendInvitation', 'cancelInvitation']);
  });

  it('inactive user actions = resetPassword + activate', () => {
    render(<CompanyUsersTab companyId="c1" />);
    const keys = tableProps.getRowActions(inactive).map((a: any) => a.key);
    expect(keys).toEqual(['resetPassword', 'activate']);
  });

  it('onView navigates to user detail', () => {
    render(<CompanyUsersTab companyId="c1" />);
    tableProps.onView('u1');
    expect(mockNavigate).toHaveBeenCalledWith('/users/u1');
  });

  it('onEdit opens the edit modal', () => {
    render(<CompanyUsersTab companyId="c1" />);
    tableProps.onEdit('u1');
    expect(mockOpenEditModal).toHaveBeenCalledWith('u1');
  });

  it('deactivate action opens the status modal', () => {
    render(<CompanyUsersTab companyId="c1" />);
    tableProps
      .getRowActions(active)
      .find((a: any) => a.key === 'deactivate')
      .onClick();
    expect(mockOpenStatusActionModal).toHaveBeenCalledWith('deactivate', 'u1', 'j@t.com');
  });

  it('resend action calls the resend mutation', () => {
    render(<CompanyUsersTab companyId="c1" />);
    tableProps
      .getRowActions(invited)
      .find((a: any) => a.key === 'resendInvitation')
      .onClick();
    expect(mockResend).toHaveBeenCalledWith('u2');
  });

  it('reset password action calls the reset mutation', () => {
    render(<CompanyUsersTab companyId="c1" />);
    tableProps
      .getRowActions(active)
      .find((a: any) => a.key === 'resetPassword')
      .onClick();
    expect(mockResetPassword).toHaveBeenCalledWith('u1', expect.any(Object));
  });

  it('status modal confirm triggers deactivate mutation', () => {
    store.isStatusActionModalOpen = true;
    store.statusActionType = 'deactivate';
    store.statusActionUserId = 'u1';
    store.statusActionUserEmail = 'j@t.com';
    render(<CompanyUsersTab companyId="c1" />);
    fireEvent.click(screen.getByTestId('status-confirm'));
    expect(mockDeactivate).toHaveBeenCalledWith('u1', expect.any(Object));
  });

  it('renders the edit modal when the store flag is set', () => {
    store.isEditModalOpen = true;
    render(<CompanyUsersTab companyId="c1" />);
    expect(screen.getByTestId('edit-user-modal')).toBeInTheDocument();
  });
});
