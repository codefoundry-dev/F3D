import {
  getUsers,
  getUser,
  updateUser,
  inviteVendorUser,
  resendVendorUserInvitation,
  cancelVendorUserInvitation,
  deactivateUser,
  reactivateUser,
  type UserListParams,
  type InviteVendorUserInput,
  type UpdateUserDto,
} from '@forethread/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/state/auth.store';

const VENDOR_USERS_KEY = 'vendor-users';

export function useVendorUsers(params?: Omit<UserListParams, 'companyId'>) {
  const companyId = useAuthStore((s) => s.currentUser?.companyId);
  const currentUserId = useAuthStore((s) => s.currentUser?.id);

  return useQuery({
    queryKey: [VENDOR_USERS_KEY, { ...params, companyId }],
    queryFn: async () => {
      const result = await getUsers({ ...params, companyId: companyId ?? undefined });
      // Exclude the current user from the list — they manage their own team here
      const filtered = result.items.filter((u) => u.id !== currentUserId);
      return {
        ...result,
        items: filtered,
        meta: {
          ...result.meta,
          total: result.meta.total - (filtered.length < result.items.length ? 1 : 0),
        },
      };
    },
    enabled: Boolean(companyId),
  });
}

export function useVendorUser(id: string) {
  return useQuery({
    queryKey: [VENDOR_USERS_KEY, id],
    queryFn: () => getUser(id),
    enabled: Boolean(id),
  });
}

export function useUpdateVendorUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) =>
      updateUser(id, dto, { skipErrorHandler: true }),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: [VENDOR_USERS_KEY] });
      void queryClient.invalidateQueries({ queryKey: [VENDOR_USERS_KEY, id] });
    },
  });
}

export function useInviteVendorUser() {
  const queryClient = useQueryClient();
  const companyId = useAuthStore((s) => s.currentUser?.companyId);

  return useMutation({
    mutationFn: (input: InviteVendorUserInput) => {
      if (!companyId) throw new Error('No company ID');
      return inviteVendorUser(companyId, input, { skipErrorHandler: true });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [VENDOR_USERS_KEY] });
    },
  });
}

export function useResendVendorUserInvitation() {
  const companyId = useAuthStore((s) => s.currentUser?.companyId);

  return useMutation({
    mutationFn: (userId: string) => {
      if (!companyId) throw new Error('No company ID');
      return resendVendorUserInvitation(companyId, userId);
    },
  });
}

export function useCancelVendorUserInvitation() {
  const queryClient = useQueryClient();
  const companyId = useAuthStore((s) => s.currentUser?.companyId);

  return useMutation({
    mutationFn: (userId: string) => {
      if (!companyId) throw new Error('No company ID');
      return cancelVendorUserInvitation(companyId, userId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [VENDOR_USERS_KEY] });
    },
  });
}

export function useDeactivateVendorUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deactivateUser(id, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [VENDOR_USERS_KEY] });
    },
  });
}

export function useReactivateVendorUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reactivateUser(id, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [VENDOR_USERS_KEY] });
    },
  });
}
