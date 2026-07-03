import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockParams = vi.hoisted(() => ({
  id: 'vendor-1' as string | undefined,
  userId: 'rep-1' as string | undefined,
}));

const mockApi = vi.hoisted(() => ({
  getVendorRepresentative: vi.fn(),
  resendVendorUserInvitation: vi.fn(),
  cancelVendorUserInvitation: vi.fn(),
  removeVendorRepresentative: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      let out = (opts?.defaultValue as string | undefined) ?? key;
      for (const [k, v] of Object.entries(opts ?? {})) {
        out = out.replace(`{{${k}}}`, String(v));
      }
      return out;
    },
  }),
}));

vi.mock('@forethread/api-client', () => mockApi);

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: (s: { setTitle: () => void }) => unknown) =>
    selector({ setTitle: vi.fn() }),
}));

vi.mock('@forethread/ui-components', () => ({
  AvatarUpload: ({ name }: { name: string }) => <div data-testid="avatar" data-name={name} />,
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="state-badge">{children}</span>
  ),
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  Spinner: () => <div data-testid="spinner" />,
  StatusActionModal: ({
    title,
    confirmLabel,
    onConfirm,
    onClose,
  }: {
    title: string;
    confirmLabel: string;
    onConfirm: () => void;
    onClose: () => void;
  }) => (
    <div data-testid="status-modal">
      <span>{title}</span>
      <button onClick={onConfirm}>{confirmLabel}</button>
      <button onClick={onClose}>Dismiss</button>
    </div>
  ),
  notificationService: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../profile/ui/ProfileInfoGrid', () => ({
  ProfileInfoGrid: (props: { status: string }) => (
    <div data-testid="info-grid" data-status={props.status} />
  ),
}));

import VendorRepresentativeDetailPage from './VendorRepresentativeDetailPage';

const baseRep = {
  id: 'rep-1',
  name: 'Jane Rep',
  email: 'jane@vendor.com',
  phone: null,
  position: 'Sales',
  department: null,
  avatarUrl: null,
  role: 'VENDOR',
  status: 'INVITED',
  createdAt: '2026-06-01T00:00:00.000Z',
  invitePending: false,
  invitedByName: 'Buyer Bob',
  companyId: 'vendor-1',
  companyName: 'VendorCo',
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VendorRepresentativeDetailPage />
    </QueryClientProvider>,
  );
}

describe('VendorRepresentativeDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams.id = 'vendor-1';
    mockParams.userId = 'rep-1';
  });

  it('renders a contact-only rep with "Not invited" state and Send invitation action', async () => {
    mockApi.getVendorRepresentative.mockResolvedValue(baseRep);
    renderPage();

    expect(await screen.findByText('Jane Rep')).toBeInTheDocument();
    expect(screen.getByTestId('state-badge')).toHaveTextContent('Not invited');
    expect(screen.getByText('Send invitation')).toBeInTheDocument();
    expect(screen.queryByText('Cancel invitation')).not.toBeInTheDocument();
    expect(screen.getByText('Added by Buyer Bob')).toBeInTheDocument();
  });

  it('renders an invite-pending rep with Resend and Cancel invitation actions', async () => {
    mockApi.getVendorRepresentative.mockResolvedValue({ ...baseRep, invitePending: true });
    renderPage();

    expect(await screen.findByText('Jane Rep')).toBeInTheDocument();
    expect(screen.getByTestId('state-badge')).toHaveTextContent('Invite sent');
    expect(screen.getByText('Resend invitation')).toBeInTheDocument();
    expect(screen.getByText('Cancel invitation')).toBeInTheDocument();
  });

  it('offers no actions for an ACTIVE rep (authority transferred to the vendor)', async () => {
    mockApi.getVendorRepresentative.mockResolvedValue({
      ...baseRep,
      status: 'ACTIVE',
      invitePending: false,
    });
    renderPage();

    expect(await screen.findByText('Jane Rep')).toBeInTheDocument();
    expect(screen.getByTestId('state-badge')).toHaveTextContent('Active');
    expect(screen.queryByText('Send invitation')).not.toBeInTheDocument();
    expect(screen.queryByText('Resend invitation')).not.toBeInTheDocument();
    expect(screen.queryByText('Remove')).not.toBeInTheDocument();
  });

  it('sends the invitation when Send invitation is clicked', async () => {
    mockApi.getVendorRepresentative.mockResolvedValue(baseRep);
    mockApi.resendVendorUserInvitation.mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByText('Send invitation'));
    await waitFor(() =>
      expect(mockApi.resendVendorUserInvitation).toHaveBeenCalledWith('vendor-1', 'rep-1'),
    );
  });

  it('removes the rep after confirmation and navigates back to the vendor profile', async () => {
    mockApi.getVendorRepresentative.mockResolvedValue(baseRep);
    mockApi.removeVendorRepresentative.mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByText('Remove'));
    expect(screen.getByTestId('status-modal')).toHaveTextContent('Remove representative?');

    fireEvent.click(
      screen.getByText('Remove', { selector: '[data-testid="status-modal"] button' }),
    );
    await waitFor(() =>
      expect(mockApi.removeVendorRepresentative).toHaveBeenCalledWith('vendor-1', 'rep-1'),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/vendors/vendor-1');
  });

  it('cancels a pending invitation after confirmation', async () => {
    mockApi.getVendorRepresentative.mockResolvedValue({ ...baseRep, invitePending: true });
    mockApi.cancelVendorUserInvitation.mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByText('Cancel invitation'));
    expect(screen.getByTestId('status-modal')).toHaveTextContent('Cancel invitation?');

    fireEvent.click(
      screen.getByText('Cancel invitation', { selector: '[data-testid="status-modal"] button' }),
    );
    await waitFor(() =>
      expect(mockApi.cancelVendorUserInvitation).toHaveBeenCalledWith('vendor-1', 'rep-1'),
    );
  });

  it('shows not-found when the fetch fails', async () => {
    mockApi.getVendorRepresentative.mockRejectedValue(new Error('403'));
    renderPage();

    expect(await screen.findByText('Representative not found')).toBeInTheDocument();
  });
});
