vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', () => ({
  getAuditLogs: vi.fn(),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  formatDateTime: (d: string) => d,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

import { getAuditLogs } from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  RolePermissionsSection,
  ApprovalResponsibilitiesSection,
  ActivityLogSection,
} from './ProfileSections';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('RolePermissionsSection', () => {
  it('renders permissions list', () => {
    render(<RolePermissionsSection />);
    expect(screen.getByText('rolePermissions')).toBeInTheDocument();
    expect(screen.getByText('permissionRfq')).toBeInTheDocument();
    expect(screen.getByText('permissionPo')).toBeInTheDocument();
    expect(screen.getByText('permissionInventory')).toBeInTheDocument();
  });
});

describe('ApprovalResponsibilitiesSection', () => {
  it('renders no responsibilities text', () => {
    render(<ApprovalResponsibilitiesSection />);
    expect(screen.getByText('approvalResponsibilities')).toBeInTheDocument();
    expect(screen.getByText('noApprovalResponsibilities')).toBeInTheDocument();
  });
});

describe('ActivityLogSection', () => {
  it('renders empty state when no logs', async () => {
    vi.mocked(getAuditLogs).mockResolvedValue({ items: [] } as never);
    render(<ActivityLogSection userId="user-1" />, { wrapper });
    await waitFor(() => expect(screen.getByText('noActivityLog')).toBeInTheDocument());
  });

  it('renders audit log entries', async () => {
    vi.mocked(getAuditLogs).mockResolvedValue({
      items: [
        {
          id: 'log-1',
          action: 'USER_CREATED',
          targetType: 'User',
          targetId: 'abcdefgh-1234',
          targetLabel: 'John Doe',
          createdAt: '2024-01-01T10:00:00Z',
        },
      ],
    } as never);

    render(<ActivityLogSection userId="user-1" />, { wrapper });
    await waitFor(() => expect(screen.getByText('User created')).toBeInTheDocument());
    expect(screen.getByText('User: John Doe')).toBeInTheDocument();
  });

  it('renders unknown action labels', async () => {
    vi.mocked(getAuditLogs).mockResolvedValue({
      items: [
        {
          id: 'log-2',
          action: 'UNKNOWN_ACTION',
          targetType: 'User',
          targetId: 'abcdefgh-1234',
          targetLabel: null,
          createdAt: '2024-01-01T10:00:00Z',
        },
      ],
    } as never);

    render(<ActivityLogSection userId="user-1" />, { wrapper });
    await waitFor(() => expect(screen.getByText('UNKNOWN_ACTION')).toBeInTheDocument());
    expect(screen.getByText('User abcdefgh')).toBeInTheDocument();
  });
});
