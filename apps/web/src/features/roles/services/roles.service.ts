import {
  getRoles,
  getRole,
  getPermissionCatalog,
  updateRolePermissions,
  type UpdateRolePermissionsDto,
} from '@forethread/api-client';
import { UserRole } from '@forethread/shared-types/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ROLES_KEY = 'roles';
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
