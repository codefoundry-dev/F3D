import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';

import { useDashboardData } from './useDashboardData';

const mockDashboard = {
  users: { total: 50, active: 42, newThisWeek: 3, byRole: [] },
  companies: { total: 10, active: 8, contractors: 5, vendors: 3, newThisWeek: 1 },
  projects: { total: 5, byStatus: { active: 3, completed: 2 } },
  procurement: { totalRfqs: 12, openRfqs: 4, totalPos: 8, totalInvoices: 6, pendingInvoices: 2 },
  system: { dbResponseMs: 15, status: 'healthy' },
};

const mockAuditLogs = {
  items: [
    {
      id: 'log-1',
      action: 'USER_CREATED',
      performedById: 'u1',
      targetType: 'User',
      targetId: 'u2',
      targetLabel: 'John Doe',
      metadata: null,
      ipAddress: null,
      createdAt: '2026-03-10T10:00:00Z',
      performedBy: { id: 'u1', name: 'Admin', email: 'admin@test.com' },
    },
  ],
  meta: { page: 1, limit: 5, total: 1, totalPages: 1 },
};

const mockGetSuperAdminDashboard = vi.fn();
const mockGetAuditLogs = vi.fn();

vi.mock('@forethread/api-client', () => ({
  getSuperAdminDashboard: (...args: unknown[]) => mockGetSuperAdminDashboard(...args),
  getAuditLogs: (...args: unknown[]) => mockGetAuditLogs(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns loading state initially', () => {
    mockGetSuperAdminDashboard.mockReturnValue(new Promise(() => {}));
    mockGetAuditLogs.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    expect(result.current.dashboardLoading).toBe(true);
    expect(result.current.auditLoading).toBe(true);
    expect(result.current.dashboard).toBeNull();
    expect(result.current.recentLogs).toEqual([]);
  });

  it('returns dashboard data after successful fetch', async () => {
    mockGetSuperAdminDashboard.mockResolvedValue(mockDashboard);
    mockGetAuditLogs.mockResolvedValue(mockAuditLogs);

    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.dashboardLoading).toBe(false);
    });

    expect(result.current.dashboard).toEqual(mockDashboard);
    expect(result.current.recentLogs).toEqual(mockAuditLogs.items);
    expect(result.current.auditLoading).toBe(false);
  });

  it('returns null dashboard and empty logs on fetch error', async () => {
    mockGetSuperAdminDashboard.mockRejectedValue(new Error('Network error'));
    mockGetAuditLogs.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.dashboardLoading).toBe(false);
    });

    expect(result.current.dashboard).toBeNull();
    expect(result.current.recentLogs).toEqual([]);
  });
});
