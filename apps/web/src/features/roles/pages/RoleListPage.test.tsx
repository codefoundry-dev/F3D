import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

vi.mock('@forethread/shared-types/client', () => ({
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    COMPANY_ADMIN: 'COMPANY_ADMIN',
    PROCUREMENT_OFFICER: 'PROCUREMENT_OFFICER',
    FINANCIAL_OFFICER: 'FINANCIAL_OFFICER',
    WAREHOUSE_OFFICER: 'WAREHOUSE_OFFICER',
    FOREMAN: 'FOREMAN',
    VENDOR: 'VENDOR',
  },
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: any) => selector({ setTitle: vi.fn() }),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
  EmptyBoxIllustration: () => <div data-testid="empty-box" />,
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} data-testid={props['data-testid']}>
      {children}
    </button>
  ),
}));

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockUseUserRole = vi.hoisted(() => vi.fn());
const mockHas = vi.hoisted(() => vi.fn());
vi.mock('@/shared/role', () => ({
  useUserRole: () => mockUseUserRole(),
  usePermissions: () => ({ has: mockHas }),
}));

const mockUseRoleList = vi.hoisted(() => vi.fn());
const mockUseCustomRoleList = vi.hoisted(() => vi.fn());
vi.mock('../services/roles.service', () => ({
  useRoleList: () => mockUseRoleList(),
  useCustomRoleList: () => mockUseCustomRoleList(),
}));

vi.mock('../components/CreateCustomRoleModal', () => ({
  CreateCustomRoleModal: ({ onCreated }: { onCreated: (id: string) => void }) => (
    <div data-testid="create-custom-role-modal">
      <button type="button" onClick={() => onCreated('cr-9')}>
        simulate-created
      </button>
    </div>
  ),
}));

import RoleListPage from './RoleListPage';

describe('RoleListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default viewer is a Super Admin (the role that owns this standalone page).
    mockUseUserRole.mockReturnValue('SUPER_ADMIN');
    mockHas.mockReturnValue(true);
    mockUseCustomRoleList.mockReturnValue({ isLoading: false, isError: false, data: [] });
  });

  it('shows a spinner while loading', () => {
    mockUseRoleList.mockReturnValue({ isLoading: true });
    render(<RoleListPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders an empty state when the request fails', () => {
    mockUseRoleList.mockReturnValue({ isError: true });
    render(<RoleListPage />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('lists every role in canonical order with its permission count', () => {
    mockUseRoleList.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        { role: 'COMPANY_ADMIN', permissionCount: 42 },
        { role: 'VENDOR', permissionCount: 30 },
      ],
    });

    render(<RoleListPage />);

    expect(screen.getByTestId('role-COMPANY_ADMIN')).toBeInTheDocument();
    expect(screen.getByTestId('role-VENDOR')).toBeInTheDocument();
    // canonical order: SUPER_ADMIN first
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAttribute('data-testid', 'role-SUPER_ADMIN');
    expect(screen.getByText(/permissionCount.*42/)).toBeInTheDocument();
  });

  it('hides the SUPER_ADMIN role from a non-super-admin viewer', () => {
    mockUseUserRole.mockReturnValue('COMPANY_ADMIN');
    mockUseRoleList.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        { role: 'COMPANY_ADMIN', permissionCount: 42 },
        { role: 'VENDOR', permissionCount: 30 },
      ],
    });

    render(<RoleListPage />);

    expect(screen.queryByTestId('role-SUPER_ADMIN')).not.toBeInTheDocument();
    expect(screen.getByTestId('role-COMPANY_ADMIN')).toBeInTheDocument();
  });

  it('navigates to /settings/roles/:role when a row is clicked', () => {
    mockUseRoleList.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [{ role: 'COMPANY_ADMIN', permissionCount: 42 }],
    });

    render(<RoleListPage />);
    fireEvent.click(screen.getByTestId('role-COMPANY_ADMIN'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings/roles/COMPANY_ADMIN');
  });

  describe('custom roles (FOR-252)', () => {
    beforeEach(() => {
      mockUseRoleList.mockReturnValue({
        isLoading: false,
        isError: false,
        data: [{ role: 'COMPANY_ADMIN', permissionCount: 42 }],
      });
    });

    it('shows the empty hint when the company has no custom roles', () => {
      render(<RoleListPage />);
      expect(screen.getByTestId('custom-roles-empty')).toBeInTheDocument();
    });

    it('lists custom roles and navigates to the custom edit page on click', () => {
      mockUseCustomRoleList.mockReturnValue({
        isLoading: false,
        isError: false,
        data: [{ id: 'cr-1', name: 'Junior Buyer', description: 'Limited PO', permissionCount: 4 }],
      });

      render(<RoleListPage />);
      expect(screen.getByText('Junior Buyer')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('custom-role-cr-1'));
      expect(mockNavigate).toHaveBeenCalledWith('/settings/roles/custom/cr-1');
    });

    it('hides the create button without the role.create permission', () => {
      mockHas.mockImplementation((key: string) => key !== 'role.create');
      render(<RoleListPage />);
      expect(screen.queryByTestId('custom-role-create')).not.toBeInTheDocument();
    });

    it('opens the create modal and navigates to the new role after creation', () => {
      render(<RoleListPage />);
      fireEvent.click(screen.getByTestId('custom-role-create'));
      expect(screen.getByTestId('create-custom-role-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByText('simulate-created'));
      expect(mockNavigate).toHaveBeenCalledWith('/settings/roles/custom/cr-9');
    });
  });
});
