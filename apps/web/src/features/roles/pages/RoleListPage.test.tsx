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

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}));

vi.mock('@forethread/ui-components/assets/icons/arrow-right.svg?react', () => ({
  default: () => <div />,
}));

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockUseRoleList = vi.hoisted(() => vi.fn());
vi.mock('../services/roles.service', () => ({
  useRoleList: () => mockUseRoleList(),
}));

import RoleListPage from './RoleListPage';

describe('RoleListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
