import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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

const mockSuccess = vi.hoisted(() => vi.fn());
const mockError = vi.hoisted(() => vi.fn());
const mockInfo = vi.hoisted(() => vi.fn());

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  Alert: ({ children, variant }: { children: React.ReactNode; variant: string }) => (
    <div data-testid={`alert-${variant}`}>{children}</div>
  ),
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
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
  notificationService: { success: mockSuccess, error: mockError, info: mockInfo },
}));

vi.mock('@forethread/ui-components/assets/icons/arrow-right.svg?react', () => ({
  default: () => <div />,
}));

const mockNavigate = vi.hoisted(() => vi.fn());
const useParamsValue = vi.hoisted(() => ({ value: { role: 'COMPANY_ADMIN' } }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => useParamsValue.value,
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
}));

const mockDetail = vi.hoisted(() => vi.fn());
const mockCatalog = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());

vi.mock('../services/roles.service', () => ({
  useRoleDetail: () => mockDetail(),
  usePermissionCatalog: () => mockCatalog(),
  useUpdateRolePermissions: () => mockUpdate(),
}));

import RoleEditPage from './RoleEditPage';

function arrange({
  detail = { permissionKeys: ['rfq.read'], thresholds: {} },
  catalog = [
    { key: 'rfq.read', description: 'Read an RFQ', thresholdAware: false },
    { key: 'rfq.create', description: 'Create an RFQ', thresholdAware: false },
  ],
  isPending = false,
  mutateAsync = vi.fn().mockResolvedValue(undefined),
} = {}) {
  mockDetail.mockReturnValue({ data: detail, isLoading: false, isError: false });
  mockCatalog.mockReturnValue({ data: catalog, isLoading: false, isError: false });
  mockUpdate.mockReturnValue({ mutateAsync, isPending });
  return { mutateAsync };
}

describe('RoleEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useParamsValue.value = { role: 'COMPANY_ADMIN' };
  });

  it('redirects to /settings/roles when the role param is invalid', () => {
    useParamsValue.value = { role: 'GHOST' as any };
    arrange();
    render(<RoleEditPage />);
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/settings/roles');
  });

  it('shows a spinner while data is loading', () => {
    mockDetail.mockReturnValue({ isLoading: true });
    mockCatalog.mockReturnValue({ isLoading: true });
    mockUpdate.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    render(<RoleEditPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('pre-checks the role’s current permissions on first render', () => {
    arrange();
    render(<RoleEditPage />);

    const readBox = screen.getByLabelText('Read an RFQ');
    const createBox = screen.getByLabelText('Create an RFQ');
    expect(readBox).toBeChecked();
    expect(createBox).not.toBeChecked();
  });

  it('disables Save until a permission is toggled', () => {
    arrange();
    render(<RoleEditPage />);
    const saveButton = screen.getByText('save').closest('button')!;
    expect(saveButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Create an RFQ'));
    expect(saveButton).not.toBeDisabled();
  });

  it('sends the full requested set to the mutation on save', async () => {
    const { mutateAsync } = arrange();
    render(<RoleEditPage />);

    fireEvent.click(screen.getByLabelText('Create an RFQ'));
    fireEvent.click(screen.getByText('save'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0]).toEqual({
      permissionKeys: expect.arrayContaining(['rfq.read', 'rfq.create']),
      thresholds: {},
    });
    expect(mockSuccess).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/settings/roles');
  });

  it('renders a threshold input next to a checked threshold-aware permission', () => {
    arrange({
      detail: { permissionKeys: ['po.approve'], thresholds: { 'po.approve': 25000 } },
      catalog: [
        { key: 'po.approve', description: 'Approve a purchase order', thresholdAware: true },
        { key: 'po.read', description: 'Read a purchase order', thresholdAware: false },
      ],
    });
    render(<RoleEditPage />);
    const input = screen.getByTestId('threshold-po.approve');
    expect(input).toHaveValue(25000);
    expect(screen.queryByTestId('threshold-po.read')).toBeNull();
  });

  it('hides the threshold input when the permission is unchecked', () => {
    arrange({
      detail: { permissionKeys: ['po.approve'], thresholds: { 'po.approve': 25000 } },
      catalog: [
        { key: 'po.approve', description: 'Approve a purchase order', thresholdAware: true },
      ],
    });
    render(<RoleEditPage />);
    expect(screen.getByTestId('threshold-po.approve')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Approve a purchase order'));
    expect(screen.queryByTestId('threshold-po.approve')).toBeNull();
  });

  it('sends thresholds with the granted permissions on save', async () => {
    const { mutateAsync } = arrange({
      detail: { permissionKeys: ['po.approve'], thresholds: { 'po.approve': 10000 } },
      catalog: [
        { key: 'po.approve', description: 'Approve a purchase order', thresholdAware: true },
      ],
    });
    render(<RoleEditPage />);
    const input = screen.getByTestId('threshold-po.approve');
    fireEvent.change(input, { target: { value: '50000' } });
    fireEvent.click(screen.getByText('save'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0]).toEqual({
      permissionKeys: ['po.approve'],
      thresholds: { 'po.approve': 50000 },
    });
  });

  it('treats blank threshold input as unlimited (null)', async () => {
    const { mutateAsync } = arrange({
      detail: { permissionKeys: ['po.approve'], thresholds: { 'po.approve': 10000 } },
      catalog: [
        { key: 'po.approve', description: 'Approve a purchase order', thresholdAware: true },
      ],
    });
    render(<RoleEditPage />);
    const input = screen.getByTestId('threshold-po.approve');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByText('save'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0]).toEqual({
      permissionKeys: ['po.approve'],
      thresholds: { 'po.approve': null },
    });
  });

  it('blocks save and shows an error when a threshold is negative', async () => {
    const { mutateAsync } = arrange({
      detail: { permissionKeys: ['po.approve'], thresholds: {} },
      catalog: [
        { key: 'po.approve', description: 'Approve a purchase order', thresholdAware: true },
      ],
    });
    render(<RoleEditPage />);
    const input = screen.getByTestId('threshold-po.approve');
    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.click(screen.getByText('save'));

    await waitFor(() => expect(mockError).toHaveBeenCalled());
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('disables every checkbox and Save when editing SUPER_ADMIN', () => {
    useParamsValue.value = { role: 'SUPER_ADMIN' };
    arrange();
    render(<RoleEditPage />);
    expect(screen.getByTestId('alert-info')).toBeInTheDocument();
    const saveButton = screen.getByText('save').closest('button')!;
    expect(saveButton).toBeDisabled();

    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) expect(cb).toBeDisabled();
  });
});
