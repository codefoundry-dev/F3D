import { render, screen, act } from '@testing-library/react';

vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <div />,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/shared-types/client', () => ({
  UserStatus: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', INVITED: 'INVITED' },
  UserRole: {
    COMPANY_ADMIN: 'COMPANY_ADMIN',
    PROCUREMENT_OFFICER: 'PROCUREMENT_OFFICER',
    FINANCIAL_OFFICER: 'FINANCIAL_OFFICER',
    WAREHOUSE_OFFICER: 'WAREHOUSE_OFFICER',
    FOREMAN: 'FOREMAN',
  },
}));

vi.mock('@forethread/ui-components', () => ({
  useDebounce: (v: unknown) => v,
  notificationService: { success: vi.fn(), error: vi.fn() },
  StatusActionModal: ({ onConfirm }: any) => (
    <div data-testid="status-action-modal">
      <button data-testid="status-confirm" onClick={onConfirm}>
        confirm
      </button>
    </div>
  ),
  StatusSuccessModal: () => <div data-testid="status-success-modal" />,
  ResetPasswordSuccessModal: () => <div data-testid="reset-password-modal" />,
}));

let tableProps: any;
vi.mock('@/features/users/shared/CompanyUsersTableView', () => ({
  CompanyUsersTableView: (props: any) => {
    tableProps = props;
    return <div data-testid="table-view" />;
  },
}));

vi.mock('@/features/users/company-admin/ui/EditUserModal', () => ({
  EditUserModal: () => <div data-testid="edit-user-modal" />,
}));
vi.mock('@/features/users/company-admin/ui/ProjectAccessModal', () => ({
  ProjectAccessModal: () => <div data-testid="project-access-modal" />,
}));

vi.mock('@/features/users/company-admin/hooks/useUserSort', () => ({
  useUserSort: () => ({ sortField: null, sortDir: null, handleSort: vi.fn() }),
}));

const mockUseUsers = vi.fn();
const mockResetPassword = vi.fn();
vi.mock('@/features/users/company-admin/services/users.service', () => ({
  useUsers: (...a: unknown[]) => mockUseUsers(...a),
  useDeactivateUser: () => ({ mutate: vi.fn(), isPending: false }),
  useReactivateUser: () => ({ mutate: vi.fn(), isPending: false }),
  useResendInvitation: () => ({ mutate: vi.fn() }),
  useCancelInvitation: () => ({ mutate: vi.fn(), isPending: false }),
  useResetUserPassword: () => ({ mutate: mockResetPassword }),
}));

const mockOpenEditModal = vi.fn();
const store: Record<string, unknown> = {};
vi.mock('@/features/users/company-admin/state/users.store', () => ({
  useUsersStore: () => store,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import { BuyerCompanyUsersTab } from './BuyerCompanyUsersTab';

function resetStore() {
  Object.assign(store, {
    isEditModalOpen: false,
    openEditModal: mockOpenEditModal,
    closeEditModal: vi.fn(),
    isStatusActionModalOpen: false,
    statusActionType: null,
    statusActionUserId: null,
    statusActionUserEmail: null,
    openStatusActionModal: vi.fn(),
    closeStatusActionModal: vi.fn(),
    isStatusSuccessModalOpen: false,
    statusSuccessType: null,
    statusSuccessUserEmail: null,
    openStatusSuccessModal: vi.fn(),
    closeStatusSuccessModal: vi.fn(),
    isResetPasswordSuccessModalOpen: false,
    resetPasswordSuccessEmail: null,
    openResetPasswordSuccessModal: vi.fn(),
    closeResetPasswordSuccessModal: vi.fn(),
    isCancelInvitationModalOpen: false,
    cancelInvitationUserId: null,
    cancelInvitationUserEmail: null,
    cancelInvitationUserName: null,
    openCancelInvitationModal: vi.fn(),
    closeCancelInvitationModal: vi.fn(),
  });
}

const active = { id: 'u1', name: 'John', email: 'j@t.com', status: 'ACTIVE', projects: [] } as any;
const invited = { id: 'u2', name: 'Bob', email: 'b@t.com', status: 'INVITED' } as any;
const inactive = {
  id: 'u3',
  name: 'Carol',
  email: 'c@t.com',
  status: 'INACTIVE',
  projects: [],
} as any;

describe('BuyerCompanyUsersTab', () => {
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
    render(<BuyerCompanyUsersTab />);
    expect(screen.getByTestId('table-view')).toBeInTheDocument();
  });

  it('active user actions = projectAccess + resetPassword + deactivate', () => {
    render(<BuyerCompanyUsersTab />);
    const keys = tableProps.getRowActions(active).map((a: any) => a.key);
    expect(keys).toEqual(['projectAccess', 'resetPassword', 'deactivate']);
  });

  it('inactive user actions = projectAccess + activate', () => {
    render(<BuyerCompanyUsersTab />);
    const keys = tableProps.getRowActions(inactive).map((a: any) => a.key);
    expect(keys).toEqual(['projectAccess', 'activate']);
  });

  it('invited user actions = resend + cancel', () => {
    render(<BuyerCompanyUsersTab />);
    const keys = tableProps.getRowActions(invited).map((a: any) => a.key);
    expect(keys).toEqual(['resendInvitation', 'cancelInvitation']);
  });

  it('onView navigates and onEdit opens edit modal', () => {
    render(<BuyerCompanyUsersTab />);
    tableProps.onView('u1');
    expect(mockNavigate).toHaveBeenCalledWith('/users/u1');
    tableProps.onEdit('u1');
    expect(mockOpenEditModal).toHaveBeenCalledWith('u1');
  });

  it('project access action opens the project access modal', () => {
    render(<BuyerCompanyUsersTab />);
    act(() => {
      tableProps
        .getRowActions(active)
        .find((a: any) => a.key === 'projectAccess')
        .onClick();
    });
    expect(screen.getByTestId('project-access-modal')).toBeInTheDocument();
  });

  it('reset password action calls the reset mutation', () => {
    render(<BuyerCompanyUsersTab />);
    tableProps
      .getRowActions(active)
      .find((a: any) => a.key === 'resetPassword')
      .onClick();
    expect(mockResetPassword).toHaveBeenCalledWith('u1', expect.any(Object));
  });
});
