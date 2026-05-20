const mockApiClient = vi.hoisted(() => ({
  getUsers: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deactivateUser: vi.fn(),
  reactivateUser: vi.fn(),
  resendInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
  initiateResetPassword: vi.fn(),
}));

const mockAuthStore = vi.hoisted(() => vi.fn());
const mockInvalidateQueries = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => mockApiClient);

// Capture callbacks so we can invoke them in tests
const capturedQuery = vi.hoisted(() => ({}) as any);
const capturedMutation = vi.hoisted(() => ({}) as any);

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((opts: any) => {
    capturedQuery.last = opts;
    return {
      queryKey: opts.queryKey,
      queryFn: opts.queryFn,
      enabled: opts.enabled,
      data: undefined,
      isLoading: false,
      isError: false,
    };
  }),
  useMutation: vi.fn((opts: any) => {
    capturedMutation.last = opts;
    return {
      mutate: opts.mutationFn,
      isPending: false,
    };
  }),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: mockInvalidateQueries,
  })),
}));

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: mockAuthStore,
}));

import {
  useUsers,
  useUser,
  useCreateUser,
  useUpdateUser,
  useDeactivateUser,
  useReactivateUser,
  useResendInvitation,
  useResetUserPassword,
  useCancelInvitation,
} from './users.service';

describe('users.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.mockReturnValue('company-1');
  });

  describe('useUsers', () => {
    it('calls useQuery with users key and companyId', () => {
      const result = useUsers({ page: 1, limit: 25 });
      expect(result).toBeDefined();
      expect((result as any).queryKey).toEqual([
        'users',
        { page: 1, limit: 25, companyId: 'company-1' },
      ]);
    });

    it('invokes queryFn which calls getUsers with params', () => {
      useUsers({ page: 1, limit: 25 });
      capturedQuery.last.queryFn();
      expect(mockApiClient.getUsers).toHaveBeenCalledWith({
        page: 1,
        limit: 25,
        companyId: 'company-1',
      });
    });

    it('sets enabled to true when companyId exists', () => {
      useUsers({ page: 1, limit: 25 });
      expect(capturedQuery.last.enabled).toBe(true);
    });

    it('sets enabled to false when companyId is falsy', () => {
      mockAuthStore.mockReturnValue(undefined);
      useUsers({ page: 1, limit: 25 });
      expect(capturedQuery.last.enabled).toBe(false);
    });

    it('passes companyId as undefined when falsy', () => {
      mockAuthStore.mockReturnValue(undefined);
      useUsers({ page: 1, limit: 25 });
      capturedQuery.last.queryFn();
      expect(mockApiClient.getUsers).toHaveBeenCalledWith({
        page: 1,
        limit: 25,
        companyId: undefined,
      });
    });
  });

  describe('useUser', () => {
    it('calls useQuery with user id', () => {
      const result = useUser('user-1');
      expect((result as any).queryKey).toEqual(['users', 'user-1']);
    });

    it('invokes queryFn which calls getUser', () => {
      useUser('user-1');
      capturedQuery.last.queryFn();
      expect(mockApiClient.getUser).toHaveBeenCalledWith('user-1');
    });

    it('sets enabled to false when id is empty', () => {
      useUser('');
      expect(capturedQuery.last.enabled).toBe(false);
    });
  });

  describe('useCreateUser', () => {
    it('returns a mutation with mutate function', () => {
      const result = useCreateUser();
      expect(result.mutate).toBeDefined();
    });

    it('invokes mutationFn which calls createUser', () => {
      useCreateUser();
      const dto = { name: 'Test', email: 'test@test.com', role: 'Member', companyId: 'c1' };
      capturedMutation.last.mutationFn(dto);
      expect(mockApiClient.createUser).toHaveBeenCalledWith(dto, { skipErrorHandler: true });
    });

    it('invokes onSuccess which invalidates queries', () => {
      useCreateUser();
      capturedMutation.last.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['users'] });
    });
  });

  describe('useUpdateUser', () => {
    it('invokes mutationFn which calls updateUser', () => {
      useUpdateUser();
      const dto = { name: 'Updated' };
      capturedMutation.last.mutationFn({ id: 'u1', dto });
      expect(mockApiClient.updateUser).toHaveBeenCalledWith('u1', dto, { skipErrorHandler: true });
    });

    it('invokes onSuccess which invalidates user queries', () => {
      useUpdateUser();
      capturedMutation.last.onSuccess(undefined, { id: 'u1' });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['users'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['users', 'u1'] });
    });
  });

  describe('useDeactivateUser', () => {
    it('invokes mutationFn which calls deactivateUser', () => {
      useDeactivateUser();
      capturedMutation.last.mutationFn('u1');
      expect(mockApiClient.deactivateUser).toHaveBeenCalledWith('u1', { skipErrorHandler: true });
    });

    it('invokes onSuccess which invalidates queries', () => {
      useDeactivateUser();
      capturedMutation.last.onSuccess(undefined, 'u1');
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['users'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['users', 'u1'] });
    });
  });

  describe('useReactivateUser', () => {
    it('invokes mutationFn which calls reactivateUser', () => {
      useReactivateUser();
      capturedMutation.last.mutationFn('u1');
      expect(mockApiClient.reactivateUser).toHaveBeenCalledWith('u1', { skipErrorHandler: true });
    });

    it('invokes onSuccess which invalidates queries', () => {
      useReactivateUser();
      capturedMutation.last.onSuccess(undefined, 'u1');
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['users'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['users', 'u1'] });
    });
  });

  describe('useResendInvitation', () => {
    it('invokes mutationFn which calls resendInvitation', () => {
      useResendInvitation();
      capturedMutation.last.mutationFn('u1');
      expect(mockApiClient.resendInvitation).toHaveBeenCalledWith('u1', { skipErrorHandler: true });
    });
  });

  describe('useResetUserPassword', () => {
    it('invokes mutationFn which calls initiateResetPassword', () => {
      useResetUserPassword();
      capturedMutation.last.mutationFn('u1');
      expect(mockApiClient.initiateResetPassword).toHaveBeenCalledWith('u1');
    });
  });

  describe('useCancelInvitation', () => {
    it('invokes mutationFn which calls cancelInvitation', () => {
      useCancelInvitation();
      capturedMutation.last.mutationFn('u1');
      expect(mockApiClient.cancelInvitation).toHaveBeenCalledWith('u1', { skipErrorHandler: true });
    });

    it('invokes onSuccess which invalidates queries', () => {
      useCancelInvitation();
      capturedMutation.last.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['users'] });
    });
  });
});
