import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

const mockSuccess = vi.hoisted(() => vi.fn());
const mockError = vi.hoisted(() => vi.fn());
const mockInfo = vi.hoisted(() => vi.fn());

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: any) => selector({ setTitle: vi.fn() }),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  Alert: ({ children, variant }: { children: React.ReactNode; variant: string }) => (
    <div data-testid={`alert-${variant}`}>{children}</div>
  ),
  Input: ({ inputSize: _s, leftIcon: _l, rightIcon: _r, error: _e, ...props }: any) => (
    <input {...props} />
  ),
  Button: ({ children, onClick, disabled, isLoading: _il, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid={props['data-testid']}>
      {children}
    </button>
  ),
  Checkbox: ({ checked, onChange, label, disabled }: any) => (
    <label data-disabled={disabled ? 'true' : 'false'}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  ),
  GridModal: ({ children, title, actions }: any) => (
    <div data-testid="grid-modal">
      <div>{title}</div>
      {children}
      {actions}
    </div>
  ),
  notificationService: { success: mockSuccess, error: mockError, info: mockInfo },
}));

const mockNavigate = vi.hoisted(() => vi.fn());
const useParamsValue = vi.hoisted(() => ({ value: { id: 'cr-1' } as { id?: string } }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => useParamsValue.value,
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
}));

const mockHas = vi.hoisted(() => vi.fn());
vi.mock('@/shared/role', () => ({
  usePermissions: () => ({ has: mockHas }),
}));

const mockDetail = vi.hoisted(() => vi.fn());
const mockCatalog = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());

vi.mock('../services/roles.service', () => ({
  useCustomRoleDetail: () => mockDetail(),
  usePermissionCatalog: () => mockCatalog(),
  useUpdateCustomRole: () => mockUpdate(),
  useDeleteCustomRole: () => mockDelete(),
}));

import CustomRoleEditPage from './CustomRoleEditPage';

function arrange({
  detail = {
    id: 'cr-1',
    name: 'Junior Buyer',
    description: 'Limited PO rights',
    permissionKeys: ['rfq.read'],
    thresholds: {} as Record<string, number>,
  },
  catalog = [
    { key: 'rfq.read', description: 'Read an RFQ', thresholdAware: false },
    { key: 'rfq.create', description: 'Create an RFQ', thresholdAware: false },
    { key: 'po.approve', description: 'Approve a purchase order', thresholdAware: true },
  ],
  mutateAsync = vi.fn().mockResolvedValue(undefined),
  deleteAsync = vi.fn().mockResolvedValue(undefined),
} = {}) {
  mockDetail.mockReturnValue({ data: detail, isLoading: false, isError: false });
  mockCatalog.mockReturnValue({ data: catalog, isLoading: false, isError: false });
  mockUpdate.mockReturnValue({ mutateAsync, isPending: false });
  mockDelete.mockReturnValue({ mutateAsync: deleteAsync, isPending: false });
  return { mutateAsync, deleteAsync };
}

describe('CustomRoleEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useParamsValue.value = { id: 'cr-1' };
    mockHas.mockReturnValue(true);
  });

  it('redirects to /settings/roles when the id param is missing', () => {
    useParamsValue.value = {};
    arrange();
    render(<CustomRoleEditPage />);
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/settings/roles');
  });

  it('shows a spinner while data is loading', () => {
    mockDetail.mockReturnValue({ isLoading: true });
    mockCatalog.mockReturnValue({ isLoading: true });
    mockUpdate.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockDelete.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    render(<CustomRoleEditPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows a not-found alert when the role fails to load', () => {
    mockDetail.mockReturnValue({ isError: true });
    mockCatalog.mockReturnValue({ data: [], isLoading: false, isError: false });
    mockUpdate.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockDelete.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    render(<CustomRoleEditPage />);
    expect(screen.getByTestId('alert-destructive')).toBeInTheDocument();
  });

  it('hydrates the name, description and granted permissions', () => {
    arrange();
    render(<CustomRoleEditPage />);

    expect(screen.getByTestId('custom-role-name')).toHaveValue('Junior Buyer');
    expect(screen.getByTestId('custom-role-description')).toHaveValue('Limited PO rights');
    expect(screen.getByLabelText('Read an RFQ')).toBeChecked();
    expect(screen.getByLabelText('Create an RFQ')).not.toBeChecked();
  });

  it('disables Save until something changes', () => {
    arrange();
    render(<CustomRoleEditPage />);
    const saveButton = screen.getByText('save').closest('button')!;
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByTestId('custom-role-name'), {
      target: { value: 'Site Buyer' },
    });
    expect(saveButton).not.toBeDisabled();
  });

  it('sends the name, description, permissions and thresholds on save', async () => {
    const { mutateAsync } = arrange({
      detail: {
        id: 'cr-1',
        name: 'Junior Buyer',
        description: '',
        permissionKeys: ['po.approve'],
        thresholds: { 'po.approve': 10000 },
      },
    });
    render(<CustomRoleEditPage />);

    fireEvent.change(screen.getByTestId('threshold-po.approve'), {
      target: { value: '50000' },
    });
    fireEvent.click(screen.getByText('save'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0]).toEqual({
      name: 'Junior Buyer',
      description: '',
      permissionKeys: ['po.approve'],
      thresholds: { 'po.approve': 50000 },
    });
    expect(mockSuccess).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/settings/roles');
  });

  it('blocks save with an error when the name is emptied', async () => {
    const { mutateAsync } = arrange();
    render(<CustomRoleEditPage />);

    fireEvent.change(screen.getByTestId('custom-role-name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('save'));

    await waitFor(() => expect(mockError).toHaveBeenCalled());
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('hides the delete button without the role.delete permission', () => {
    mockHas.mockImplementation((key: string) => key !== 'role.delete');
    arrange();
    render(<CustomRoleEditPage />);
    expect(screen.queryByTestId('custom-role-delete')).not.toBeInTheDocument();
  });

  it('deletes the role after confirming and navigates back to the list', async () => {
    const { deleteAsync } = arrange();
    render(<CustomRoleEditPage />);

    fireEvent.click(screen.getByTestId('custom-role-delete'));
    expect(screen.getByTestId('grid-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('custom-role-delete-confirm'));

    await waitFor(() => expect(deleteAsync).toHaveBeenCalledWith('cr-1'));
    expect(mockSuccess).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/settings/roles');
  });
});
