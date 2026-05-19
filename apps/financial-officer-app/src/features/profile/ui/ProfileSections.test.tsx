import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockGetAuditLogs = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', () => ({
  getAuditLogs: mockGetAuditLogs,
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner">Loading</div>,
  formatDateTime: (d: string) => d,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/clock.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/user-outline.svg?react', () => ({
  default: () => <span />,
}));

import {
  RolePermissionsSection,
  ApprovalResponsibilitiesSection,
  ActivityLogSection,
} from './ProfileSections';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('RolePermissionsSection', () => {
  it('renders permissions section title', () => {
    render(<RolePermissionsSection />, { wrapper });
    expect(screen.getByText('rolePermissions')).toBeInTheDocument();
  });

  it('renders permission items', () => {
    render(<RolePermissionsSection />, { wrapper });
    expect(screen.getByText('permissionRfq')).toBeInTheDocument();
    expect(screen.getByText('permissionPo')).toBeInTheDocument();
    expect(screen.getByText('permissionInventory')).toBeInTheDocument();
  });
});

describe('ApprovalResponsibilitiesSection', () => {
  it('renders section title', () => {
    render(<ApprovalResponsibilitiesSection />, { wrapper });
    expect(screen.getByText('approvalResponsibilities')).toBeInTheDocument();
  });

  it('renders no responsibilities message', () => {
    render(<ApprovalResponsibilitiesSection />, { wrapper });
    expect(screen.getByText('noApprovalResponsibilities')).toBeInTheDocument();
  });
});

describe('ActivityLogSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders section title', () => {
    mockGetAuditLogs.mockReturnValue(new Promise(() => {}));
    render(<ActivityLogSection userId="user-1" />, { wrapper });
    expect(screen.getByText('activityLog')).toBeInTheDocument();
  });

  it('shows spinner while loading', () => {
    mockGetAuditLogs.mockReturnValue(new Promise(() => {}));
    render(<ActivityLogSection userId="user-1" />, { wrapper });
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows empty state when no logs', async () => {
    mockGetAuditLogs.mockResolvedValue({ items: [] });
    render(<ActivityLogSection userId="user-1" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('noActivityLog')).toBeInTheDocument();
    });
  });

  it('renders audit log items', async () => {
    mockGetAuditLogs.mockResolvedValue({
      items: [
        {
          id: 'log-1',
          action: 'USER_CREATED',
          targetType: 'User',
          targetId: '12345678-abcd',
          targetLabel: 'John Doe',
          createdAt: '2026-01-15T10:00:00Z',
        },
      ],
    });
    render(<ActivityLogSection userId="user-1" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('User created')).toBeInTheDocument();
      expect(screen.getByText('User: John Doe')).toBeInTheDocument();
    });
  });

  it('renders unknown action labels as-is', async () => {
    mockGetAuditLogs.mockResolvedValue({
      items: [
        {
          id: 'log-2',
          action: 'SOME_NEW_ACTION',
          targetType: 'Resource',
          targetId: 'abcdefgh-1234',
          targetLabel: null,
          createdAt: '2026-02-01T10:00:00Z',
        },
      ],
    });
    render(<ActivityLogSection userId="user-1" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('SOME_NEW_ACTION')).toBeInTheDocument();
      expect(screen.getByText('Resource abcdefgh')).toBeInTheDocument();
    });
  });
});
