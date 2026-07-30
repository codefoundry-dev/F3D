import {
  getRoles,
  getRole,
  getPermissionCatalog,
  updateRolePermissions,
  getCustomRoles,
  getCustomRole,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  type UpdateRolePermissionsDto,
  type CreateCustomRoleDto,
  type UpdateCustomRoleDto,
} from '@forethread/api-client';
import { UserRole } from '@forethread/shared-types/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ROLES_KEY = 'roles';
const CUSTOM_ROLES_KEY = 'custom-roles';
const CATALOG_KEY = 'permissions-catalog';

export function useRoleList() {
  return useQuery({ queryKey: [ROLES_KEY], queryFn: () => getRoles() });
}

export function useRoleDetail(role: UserRole | string) {
  return useQuery({
    queryKey: [ROLES_KEY, role],
    queryFn: () => getRole(role),
    enabled: Boolean(role),
  });
}

export function usePermissionCatalog() {
  return useQuery({ queryKey: [CATALOG_KEY], queryFn: () => getPermissionCatalog() });
}

export function useUpdateRolePermissions(role: UserRole | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateRolePermissionsDto) =>
      updateRolePermissions(role, dto, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ROLES_KEY] });
    },
  });
}

// ── Custom roles (FOR-252) ───────────────────────────────────────────────────

/** `enabled: false` skips the fetch for callers without `role.list` (FOR-253). */
export function useCustomRoleList(enabled = true) {
  return useQuery({ queryKey: [CUSTOM_ROLES_KEY], queryFn: () => getCustomRoles(), enabled });
}

export function useCustomRoleDetail(id: string) {
  return useQuery({
    queryKey: [CUSTOM_ROLES_KEY, id],
    queryFn: () => getCustomRole(id),
    enabled: Boolean(id),
  });
}

export function useCreateCustomRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateCustomRoleDto) => createCustomRole(dto, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CUSTOM_ROLES_KEY] });
    },
  });
}

export function useUpdateCustomRole(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateCustomRoleDto) => updateCustomRole(id, dto, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CUSTOM_ROLES_KEY] });
    },
  });
}

export function useDeleteCustomRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCustomRole(id, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CUSTOM_ROLES_KEY] });
    },
  });
}
