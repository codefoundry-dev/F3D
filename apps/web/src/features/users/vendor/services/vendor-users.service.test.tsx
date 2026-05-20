import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockGetUsers = vi.fn().mockResolvedValue({
  items: [
    { id: 'user-1', name: 'Alice', email: 'a@b.com', status: 'ACTIVE', createdAt: '2024-01-01' },
    {
      id: 'current-user',
      name: 'Me',
      email: 'me@b.com',
      status: 'ACTIVE',
      createdAt: '2024-01-01',
    },
  ],
  meta: { page: 1, limit: 25, total: 2, totalPages: 1 },
});
const mockInviteVendorUser = vi.fn().mockResolvedValue({ id: 'new-user' });
const mockResendVendorUserInvitation = vi.fn().mockResolvedValue(undefined);
const mockCancelVendorUserInvitation = vi.fn().mockResolvedValue(undefined);
const mockDeactivateUser = vi.fn().mockResolvedValue(undefined);
const mockReactivateUser = vi.fn().mockResolvedValue(undefined);

vi.mock('@forethread/api-client', () => ({
  getUsers: (...args: unknown[]) => mockGetUsers(...args),
  inviteVendorUser: (...args: unknown[]) => mockInviteVendorUser(...args),
  resendVendorUserInvitation: (...args: unknown[]) => mockResendVendorUserInvitation(...args),
  cancelVendorUserInvitation: (...args: unknown[]) => mockCancelVendorUserInvitation(...args),
  deactivateUser: (...args: unknown[]) => mockDeactivateUser(...args),
  reactivateUser: (...args: unknown[]) => mockReactivateUser(...args),
}));

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ currentUser: { id: 'current-user', companyId: 'company-1' } }),
}));

import {
  useVendorUsers,
  useInviteVendorUser,
  useResendVendorUserInvitation,
  useCancelVendorUserInvitation,
  useDeactivateVendorUser,
  useReactivateVendorUser,
} from './vendor-users.service';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('vendor-users.service', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('useVendorUsers', () => {
    it('fetches users and excludes current user', async () => {
      const { result } = renderHook(() => useVendorUsers(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.items).toHaveLength(1);
      expect(result.current.data?.items[0].id).toBe('user-1');
      expect(result.current.data?.meta.total).toBe(1);
    });

    it('passes params to getUsers', async () => {
      const { result } = renderHook(() => useVendorUsers({ search: 'alice' }), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGetUsers).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'alice', companyId: 'company-1' }),
      );
    });
  });

  describe('useInviteVendorUser', () => {
    it('calls inviteVendorUser with companyId', async () => {
      const { result } = renderHook(() => useInviteVendorUser(), { wrapper: createWrapper() });
      result.current.mutate({ name: 'Bob', email: 'bob@b.com', position: 'Dev' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockInviteVendorUser).toHaveBeenCalledWith(
        'company-1',
        {
          name: 'Bob',
          email: 'bob@b.com',
          position: 'Dev',
        },
        { skipErrorHandler: true },
      );
    });
  });

  describe('useResendVendorUserInvitation', () => {
    it('calls resendVendorUserInvitation', async () => {
      const { result } = renderHook(() => useResendVendorUserInvitation(), {
        wrapper: createWrapper(),
      });
      result.current.mutate('user-99');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockResendVendorUserInvitation).toHaveBeenCalledWith('company-1', 'user-99');
    });
  });

  describe('useCancelVendorUserInvitation', () => {
    it('calls cancelVendorUserInvitation', async () => {
      const { result } = renderHook(() => useCancelVendorUserInvitation(), {
        wrapper: createWrapper(),
      });
      result.current.mutate('user-88');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockCancelVendorUserInvitation).toHaveBeenCalledWith('company-1', 'user-88');
    });
  });

  describe('useDeactivateVendorUser', () => {
    it('calls deactivateUser', async () => {
      const { result } = renderHook(() => useDeactivateVendorUser(), { wrapper: createWrapper() });
      result.current.mutate('user-77');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockDeactivateUser).toHaveBeenCalledWith('user-77', { skipErrorHandler: true });
    });
  });

  describe('useReactivateVendorUser', () => {
    it('calls reactivateUser', async () => {
      const { result } = renderHook(() => useReactivateVendorUser(), { wrapper: createWrapper() });
      result.current.mutate('user-66');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockReactivateUser).toHaveBeenCalledWith('user-66', { skipErrorHandler: true });
    });
  });
});
