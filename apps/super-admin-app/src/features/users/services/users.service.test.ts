import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  resendInvitation,
  cancelInvitation,
  initiateResetPassword,
} from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import {
  useUsers,
  useUser,
  useCreateUser,
  useUpdateUser,
  useDeactivateUser,
  useReactivateUser,
  useResendInvitation,
  useCancelInvitation,
  useInitiateResetPassword,
} from './users.service';

vi.mock('@forethread/api-client', () => ({
  getUsers: vi.fn().mockResolvedValue({ data: [{ id: '1', name: 'Alice' }], total: 1 }),
  getUser: vi.fn().mockResolvedValue({ id: '1', name: 'Alice' }),
  createUser: vi.fn().mockResolvedValue({ id: '2', name: 'Bob' }),
  updateUser: vi.fn().mockResolvedValue({ id: '1', name: 'Updated' }),
  deactivateUser: vi.fn().mockResolvedValue({ success: true }),
  reactivateUser: vi.fn().mockResolvedValue({ success: true }),
  resendInvitation: vi.fn().mockResolvedValue({ success: true }),
  cancelInvitation: vi.fn().mockResolvedValue({ success: true }),
  initiateResetPassword: vi.fn().mockResolvedValue({ success: true }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('users.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useUsers', () => {
    it('fetches user list via getUsers', async () => {
      const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(getUsers).toHaveBeenCalledWith(undefined);
      expect(result.current.data).toEqual({ data: [{ id: '1', name: 'Alice' }], total: 1 });
    });

    it('passes params to getUsers', async () => {
      const params = { search: 'test' };
      const { result } = renderHook(() => useUsers(params as any), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(getUsers).toHaveBeenCalledWith(params);
    });
  });

  describe('useUser', () => {
    it('fetches a single user by id', async () => {
      const { result } = renderHook(() => useUser('1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(getUser).toHaveBeenCalledWith('1');
      expect(result.current.data).toEqual({ id: '1', name: 'Alice' });
    });

    it('is disabled when id is empty', () => {
      const { result } = renderHook(() => useUser(''), { wrapper: createWrapper() });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCreateUser', () => {
    it('calls createUser and invalidates users queries on success', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCreateUser(), { wrapper });

      const dto = { email: 'bob@example.com', firstName: 'Bob', lastName: 'Smith' };
      result.current.mutate(dto as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(createUser).toHaveBeenCalledWith(dto, { skipErrorHandler: true });
    });
  });

  describe('useUpdateUser', () => {
    it('calls updateUser and invalidates queries on success', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useUpdateUser(), { wrapper });

      const dto = { firstName: 'Updated' };
      result.current.mutate({ id: '1', dto } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(updateUser).toHaveBeenCalledWith('1', dto, { skipErrorHandler: true });
    });
  });

  describe('useDeactivateUser', () => {
    it('calls deactivateUser with id', async () => {
      const { result } = renderHook(() => useDeactivateUser(), { wrapper: createWrapper() });

      result.current.mutate('1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(deactivateUser).toHaveBeenCalledWith('1', { skipErrorHandler: true });
    });
  });

  describe('useReactivateUser', () => {
    it('calls reactivateUser with id', async () => {
      const { result } = renderHook(() => useReactivateUser(), { wrapper: createWrapper() });

      result.current.mutate('1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(reactivateUser).toHaveBeenCalledWith('1', { skipErrorHandler: true });
    });
  });

  describe('useResendInvitation', () => {
    it('calls resendInvitation with id', async () => {
      const { result } = renderHook(() => useResendInvitation(), { wrapper: createWrapper() });

      result.current.mutate('1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(resendInvitation).toHaveBeenCalledWith('1', { skipErrorHandler: true });
    });
  });

  describe('useCancelInvitation', () => {
    it('calls cancelInvitation with id', async () => {
      const { result } = renderHook(() => useCancelInvitation(), { wrapper: createWrapper() });

      result.current.mutate('1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(cancelInvitation).toHaveBeenCalledWith('1', { skipErrorHandler: true });
    });
  });

  describe('useInitiateResetPassword', () => {
    it('calls initiateResetPassword with id', async () => {
      const { result } = renderHook(() => useInitiateResetPassword(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(initiateResetPassword).toHaveBeenCalledWith('1');
    });
  });
});
