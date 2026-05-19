import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';

import { usePlatformState } from './usePlatformState';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => (opts?.name ? `${key}:${opts.name}` : key),
  }),
}));

const mockNotificationSuccess = vi.fn();
vi.mock('@forethread/ui-components', () => ({
  notificationService: { success: (...args: unknown[]) => mockNotificationSuccess(...args) },
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

const mockComponents = [
  {
    id: 'c1',
    name: 'Email Service',
    status: 'Healthy' as const,
    category: 'integration' as const,
    lastSuccessfulRun: '2026-03-10T10:00:00Z',
    lastError: null,
    errorInfo: null,
  },
  {
    id: 'c2',
    name: 'Report Generator',
    status: 'Error' as const,
    category: 'backgroundJob' as const,
    lastSuccessfulRun: '2026-03-09T08:00:00Z',
    lastError: '2026-03-10T09:00:00Z',
    errorInfo: 'Timeout',
  },
  {
    id: 'c3',
    name: 'SMS Gateway',
    status: 'Disabled' as const,
    category: 'integration' as const,
    lastSuccessfulRun: null,
    lastError: null,
    errorInfo: null,
  },
  {
    id: 'c4',
    name: 'Audit Logger',
    status: 'Warning' as const,
    category: 'notification' as const,
    lastSuccessfulRun: '2026-03-10T11:00:00Z',
    lastError: '2026-03-10T10:30:00Z',
    errorInfo: 'High latency',
  },
];

const mockGetAdminPanelState = vi.fn();

vi.mock('@forethread/api-client', () => ({
  getAdminPanelState: (...args: unknown[]) => mockGetAdminPanelState(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('usePlatformState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns loading state initially', () => {
    mockGetAdminPanelState.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => usePlatformState(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.sortedComponents).toEqual([]);
  });

  it('returns components after successful fetch', async () => {
    mockGetAdminPanelState.mockResolvedValue({ components: mockComponents });

    const { result } = renderHook(() => usePlatformState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.sortedComponents).toHaveLength(4);
  });

  it('sorts components ascending by name when handleSort is called once', async () => {
    mockGetAdminPanelState.mockResolvedValue({ components: mockComponents });

    const { result } = renderHook(() => usePlatformState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.handleSort('component');
    });

    expect(result.current.sort).toEqual({ column: 'component', direction: 'asc' });
    expect(result.current.sortedComponents[0].name).toBe('Audit Logger');
    expect(result.current.sortedComponents[3].name).toBe('SMS Gateway');
  });

  it('sorts descending on second click and resets on third', async () => {
    mockGetAdminPanelState.mockResolvedValue({ components: mockComponents });

    const { result } = renderHook(() => usePlatformState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => result.current.handleSort('component'));
    expect(result.current.sort.direction).toBe('asc');

    act(() => result.current.handleSort('component'));
    expect(result.current.sort.direction).toBe('desc');
    expect(result.current.sortedComponents[0].name).toBe('SMS Gateway');

    act(() => result.current.handleSort('component'));
    expect(result.current.sort).toEqual({ column: null, direction: null });
  });

  it('sorts by status column', async () => {
    mockGetAdminPanelState.mockResolvedValue({ components: mockComponents });

    const { result } = renderHook(() => usePlatformState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => result.current.handleSort('status'));

    expect(result.current.sortedComponents[0].status).toBe('Disabled');
    expect(result.current.sortedComponents[3].status).toBe('Warning');
  });

  it('toggleIntegration disables a healthy integration', async () => {
    mockGetAdminPanelState.mockResolvedValue({ components: mockComponents });

    const { result } = renderHook(() => usePlatformState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const emailService = result.current.sortedComponents.find((c) => c.id === 'c1')!;

    act(() => {
      result.current.toggleIntegration(emailService);
    });

    const updated = result.current.sortedComponents.find((c) => c.id === 'c1')!;
    expect(updated.status).toBe('Disabled');
    expect(mockNotificationSuccess).toHaveBeenCalledWith(
      'platformState.integrationDisabled:Email Service',
    );
  });

  it('toggleIntegration enables a disabled integration', async () => {
    mockGetAdminPanelState.mockResolvedValue({ components: mockComponents });

    const { result } = renderHook(() => usePlatformState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const smsGateway = result.current.sortedComponents.find((c) => c.id === 'c3')!;

    act(() => {
      result.current.toggleIntegration(smsGateway);
    });

    const updated = result.current.sortedComponents.find((c) => c.id === 'c3')!;
    expect(updated.status).toBe('Healthy');
    expect(mockNotificationSuccess).toHaveBeenCalledWith(
      'platformState.integrationEnabled:SMS Gateway',
    );
  });

  it('reloadComponent sets component to healthy after timeout', async () => {
    mockGetAdminPanelState.mockResolvedValue({ components: mockComponents });

    const { result } = renderHook(() => usePlatformState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const errorComponent = result.current.sortedComponents.find((c) => c.id === 'c2')!;

    act(() => {
      result.current.reloadComponent(errorComponent);
    });

    expect(result.current.isReloading('c2')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.isReloading('c2')).toBe(false);
    const updated = result.current.sortedComponents.find((c) => c.id === 'c2')!;
    expect(updated.status).toBe('Healthy');
    expect(mockNotificationSuccess).toHaveBeenCalledWith(
      'platformState.reloadSuccess:Report Generator',
    );
  });

  it('canToggle returns true only for integration category', async () => {
    mockGetAdminPanelState.mockResolvedValue({ components: mockComponents });

    const { result } = renderHook(() => usePlatformState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const integration = mockComponents.find((c) => c.category === 'integration')!;
    const bgJob = mockComponents.find((c) => c.category === 'backgroundJob')!;

    expect(result.current.canToggle(integration)).toBe(true);
    expect(result.current.canToggle(bgJob)).toBe(false);
  });

  it('canReload returns true only for Error or Warning status', async () => {
    mockGetAdminPanelState.mockResolvedValue({ components: mockComponents });

    const { result } = renderHook(() => usePlatformState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const healthy = mockComponents.find((c) => c.status === 'Healthy')!;
    const error = mockComponents.find((c) => c.status === 'Error')!;
    const warning = mockComponents.find((c) => c.status === 'Warning')!;
    const disabled = mockComponents.find((c) => c.status === 'Disabled')!;

    expect(result.current.canReload(healthy)).toBe(false);
    expect(result.current.canReload(error)).toBe(true);
    expect(result.current.canReload(warning)).toBe(true);
    expect(result.current.canReload(disabled)).toBe(false);
  });

  it('isDisabled returns true only for Disabled status', async () => {
    mockGetAdminPanelState.mockResolvedValue({ components: mockComponents });

    const { result } = renderHook(() => usePlatformState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const disabled = mockComponents.find((c) => c.status === 'Disabled')!;
    const healthy = mockComponents.find((c) => c.status === 'Healthy')!;

    expect(result.current.isDisabled(disabled)).toBe(true);
    expect(result.current.isDisabled(healthy)).toBe(false);
  });
});
