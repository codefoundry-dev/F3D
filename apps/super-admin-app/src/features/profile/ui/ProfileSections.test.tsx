import { render, screen } from '@testing-library/react';

// Mock SVG icons
vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/clock.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/user-outline.svg?react', () => ({
  default: () => <div />,
}));

// Mock i18n
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock ui-components
vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  formatDateTime: (date: string) => new Date(date).toLocaleString(),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

// Mock tanstack query
const mockUseQuery = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

// Mock api-client
vi.mock('@forethread/api-client', () => ({
  getAuditLogs: vi.fn(),
}));

// Mock constants
vi.mock('../../../../../../packages/profile-shared/src/constants', () => ({
  DEFAULT_PERMISSION_KEYS: ['permissionRfq', 'permissionPo', 'permissionInventory'],
  AUDIT_ACTION_LABELS: {
    USER_CREATED: 'User created',
    USER_UPDATED: 'User updated',
    COMPANY_UPDATED: 'Company updated',
  },
}));

vi.mock('../constants', () => ({
  PERMISSION_KEYS: ['permissionRfq', 'permissionPo', 'permissionInventory'],
}));

import {
  RolePermissionsSection,
  ApprovalResponsibilitiesSection,
  ActivityLogSection,
} from './ProfileSections';

describe('RolePermissionsSection', () => {
  it('renders section header', () => {
    render(<RolePermissionsSection />);
    expect(screen.getByText('rolePermissions')).toBeInTheDocument();
  });

  it('renders permission items', () => {
    render(<RolePermissionsSection />);
    expect(screen.getByText('permissionRfq')).toBeInTheDocument();
    expect(screen.getByText('permissionPo')).toBeInTheDocument();
    expect(screen.getByText('permissionInventory')).toBeInTheDocument();
  });

  it('renders permissions label', () => {
    render(<RolePermissionsSection />);
    expect(screen.getByText('permissions:')).toBeInTheDocument();
  });
});

describe('ApprovalResponsibilitiesSection', () => {
  it('renders section header', () => {
    render(<ApprovalResponsibilitiesSection />);
    expect(screen.getByText('approvalResponsibilities')).toBeInTheDocument();
  });

  it('renders no responsibilities message', () => {
    render(<ApprovalResponsibilitiesSection />);
    expect(screen.getByText('noApprovalResponsibilities')).toBeInTheDocument();
  });
});

describe('ActivityLogSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders section header', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    render(<ActivityLogSection userId="u1" />);
    expect(screen.getByText('activityLog')).toBeInTheDocument();
  });

  it('renders spinner when loading', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    render(<ActivityLogSection userId="u1" />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders no activity message when empty', () => {
    mockUseQuery.mockReturnValue({ data: { items: [] }, isLoading: false });
    render(<ActivityLogSection userId="u1" />);
    expect(screen.getByText('noActivityLog')).toBeInTheDocument();
  });

  it('renders audit log items', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'log1',
            action: 'USER_CREATED',
            targetType: 'User',
            targetId: 'abcdef12-3456-7890',
            targetLabel: 'John Doe',
            createdAt: '2026-01-15T10:30:00Z',
          },
        ],
      },
      isLoading: false,
    });
    render(<ActivityLogSection userId="u1" />);
    expect(screen.getByText('User created')).toBeInTheDocument();
  });

  it('renders targetId truncated when targetLabel is null', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'log2',
            action: 'COMPANY_UPDATED',
            targetType: 'Company',
            targetId: 'abcdefgh-1234-5678',
            targetLabel: null,
            createdAt: '2026-02-01T12:00:00Z',
          },
        ],
      },
      isLoading: false,
    });
    render(<ActivityLogSection userId="u1" />);
    expect(screen.getByText(/Company abcdefgh/)).toBeInTheDocument();
  });

  it('renders unknown action as raw action string', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'log3',
            action: 'UNKNOWN_ACTION',
            targetType: 'Widget',
            targetId: 'xyz12345-9999',
            targetLabel: 'Widget A',
            createdAt: '2026-02-15T14:00:00Z',
          },
        ],
      },
      isLoading: false,
    });
    render(<ActivityLogSection userId="u1" />);
    expect(screen.getByText('UNKNOWN_ACTION')).toBeInTheDocument();
  });

  it('renders connector line between multiple log items', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'log1',
            action: 'USER_CREATED',
            targetType: 'User',
            targetId: 'abc12345',
            targetLabel: 'Alice',
            createdAt: '2026-01-15T10:30:00Z',
          },
          {
            id: 'log2',
            action: 'USER_UPDATED',
            targetType: 'User',
            targetId: 'abc12345',
            targetLabel: 'Alice',
            createdAt: '2026-01-16T11:00:00Z',
          },
        ],
      },
      isLoading: false,
    });
    render(<ActivityLogSection userId="u1" />);
    expect(screen.getByText('User created')).toBeInTheDocument();
    expect(screen.getByText('User updated')).toBeInTheDocument();
  });
});
