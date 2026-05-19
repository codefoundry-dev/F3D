import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetAuditLogs = vi.fn();

vi.mock('@forethread/api-client', () => ({
  getAuditLogs: (params: unknown) => mockGetAuditLogs(params),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: ({ size }: { size: string }) => <div data-testid="spinner" data-size={size} />,
  formatDateTime: (d: string) => `formatted-${d}`,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/clock.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/user-outline.svg?react', () => ({
  default: () => <div />,
}));

import {
  RolePermissionsSection,
  ApprovalResponsibilitiesSection,
  ActivityLogSection,
} from './ProfileSections';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
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
  it('renders no approval responsibilities message', () => {
    render(<ApprovalResponsibilitiesSection />);
    expect(screen.getByText('approvalResponsibilities')).toBeInTheDocument();
    expect(screen.getByText('noApprovalResponsibilities')).toBeInTheDocument();
  });
});

describe('ActivityLogSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders section header', () => {
    mockGetAuditLogs.mockResolvedValue({ items: [] });
    render(<ActivityLogSection userId="user-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('activityLog')).toBeInTheDocument();
  });

  it('shows no activity log when no items', async () => {
    mockGetAuditLogs.mockResolvedValue({ items: [] });
    render(<ActivityLogSection userId="user-1" />, { wrapper: createWrapper() });

    await screen.findByText('noActivityLog');
    expect(screen.getByText('noActivityLog')).toBeInTheDocument();
  });

  it('renders audit log items', async () => {
    mockGetAuditLogs.mockResolvedValue({
      items: [
        {
          id: 'log-1',
          action: 'USER_CREATED',
          targetType: 'User',
          targetId: '12345678-abcd-efgh',
          targetLabel: 'John Doe',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'log-2',
          action: 'UNKNOWN_ACTION',
          targetType: 'Project',
          targetId: 'abcdefgh-1234-5678',
          targetLabel: null,
          createdAt: '2026-01-02T00:00:00Z',
        },
      ],
    });

    render(<ActivityLogSection userId="user-1" />, { wrapper: createWrapper() });

    await screen.findByText('User created');
    expect(screen.getByText('User created')).toBeInTheDocument();
    expect(screen.getByText('User: John Doe')).toBeInTheDocument();
    expect(screen.getByText('UNKNOWN_ACTION')).toBeInTheDocument();
    expect(screen.getByText('Project abcdefgh')).toBeInTheDocument();
  });

  it('does not fetch when userId is undefined', () => {
    mockGetAuditLogs.mockResolvedValue({ items: [] });
    render(<ActivityLogSection />, { wrapper: createWrapper() });
    expect(mockGetAuditLogs).not.toHaveBeenCalled();
  });
});
