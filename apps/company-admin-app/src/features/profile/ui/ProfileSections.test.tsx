import { render, screen } from '@testing-library/react';

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/clock.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/user-outline.svg?react', () => ({
  default: () => <div />,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  formatDateTime: (date: string) => new Date(date).toLocaleString(),
}));

const mockUseQuery = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('@forethread/api-client', () => ({
  getAuditLogs: vi.fn(),
}));

vi.mock('../../../../../../packages/profile-shared/src/constants', () => ({
  DEFAULT_PERMISSION_KEYS: ['permissionRfq', 'permissionPo', 'permissionInventory'],
  AUDIT_ACTION_LABELS: {
    USER_CREATED: 'User created',
    USER_UPDATED: 'User updated',
    USER_DEACTIVATED: 'User deactivated',
    USER_REACTIVATED: 'User reactivated',
    USER_INVITATION_RESENT: 'Invitation resent',
    USER_INVITATION_CANCELLED: 'Invitation cancelled',
    USER_PASSWORD_RESET_INITIATED: 'Password reset initiated',
    COMPANY_CREATED: 'Company created',
    COMPANY_UPDATED: 'Company updated',
    FILE_UPLOADED: 'File uploaded',
    FILE_DELETED: 'File deleted',
    PROJECT_CREATED: 'Project created',
    PROJECT_UPDATED: 'Project updated',
    PROJECT_MEMBER_ADDED: 'Project member added',
    PROJECT_MEMBER_REMOVED: 'Project member removed',
    VENDOR_ASSIGNED: 'Vendor assigned',
    VENDOR_UNASSIGNED: 'Vendor unassigned',
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
  beforeEach(() => vi.clearAllMocks());

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
            targetId: 'abcdef12-3456',
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
            targetId: 'xyz12345',
            targetLabel: 'W1',
            createdAt: '2026-02-15T14:00:00Z',
          },
        ],
      },
      isLoading: false,
    });
    render(<ActivityLogSection userId="u1" />);
    expect(screen.getByText('UNKNOWN_ACTION')).toBeInTheDocument();
  });
});
