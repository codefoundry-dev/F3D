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
  type UserListParams,
  type CreateUserDto,
  type UpdateUserDto,
} from '@forethread/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const USERS_KEY = 'users';

export function useUsers(params?: UserListParams) {
  return useQuery({
    queryKey: [USERS_KEY, params],
    queryFn: () => getUsers(params),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: [USERS_KEY, id],
    queryFn: () => getUser(id),
    enabled: Boolean(id),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateUserDto) => createUser(dto, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) =>
      updateUser(id, dto, { skipErrorHandler: true }),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      void queryClient.invalidateQueries({ queryKey: [USERS_KEY, id] });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deactivateUser(id, { skipErrorHandler: true }),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      void queryClient.invalidateQueries({ queryKey: [USERS_KEY, id] });
    },
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reactivateUser(id, { skipErrorHandler: true }),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      void queryClient.invalidateQueries({ queryKey: [USERS_KEY, id] });
    },
  });
}

export function useResendInvitation() {
  return useMutation({
    mutationFn: (id: string) => resendInvitation(id, { skipErrorHandler: true }),
  });
}

export function useCancelInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cancelInvitation(id, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
    },
  });
}

export function useInitiateResetPassword() {
  return useMutation({
    mutationFn: (id: string) => initiateResetPassword(id),
  });
}
