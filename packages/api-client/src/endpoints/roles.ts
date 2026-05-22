import { UserRole } from '@forethread/shared-types/client';
import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { ROLES_PATHS } from './paths';

export interface PermissionCatalogEntry {
  key: string;
  description: string;
}

export interface RoleSummary {
  role: UserRole;
  permissionCount: number;
}

export interface RoleDetail {
  role: UserRole;
  permissionKeys: string[];
}

export interface UpdateRolePermissionsDto {
  permissionKeys: string[];
}

export async function getPermissionCatalog(): Promise<PermissionCatalogEntry[]> {
  const { data } = await getApiClient().get<{ data: { items: PermissionCatalogEntry[] } }>(
    ROLES_PATHS.CATALOG,
  );
  return data.data.items;
}

export async function getRoles(): Promise<RoleSummary[]> {
  const { data } = await getApiClient().get<{ data: { items: RoleSummary[] } }>(ROLES_PATHS.ROOT);
  return data.data.items;
}

export async function getRole(role: UserRole | string): Promise<RoleDetail> {
  const { data } = await getApiClient().get<{ data: RoleDetail }>(ROLES_PATHS.byRole(role));
  return data.data;
}

export async function updateRolePermissions(
  role: UserRole | string,
  dto: UpdateRolePermissionsDto,
  config?: AxiosRequestConfig,
): Promise<RoleDetail> {
  const { data } = await getApiClient().put<{ data: RoleDetail }>(
    ROLES_PATHS.permissions(role),
    dto,
    config,
  );
  return data.data;
}
