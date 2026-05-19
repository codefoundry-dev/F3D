import { UserRole, UserStatus } from '@forethread/shared-types/client';
import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { USERS_PATHS } from './paths';

export interface CreateUserDto {
  name: string;
  email: string;
  role: string;
  companyId: string;
  position?: string;
  phone?: string;
}

export interface UpdateUserDto {
  name?: string;
  role?: string;
  position?: string;
  phone?: string;
}

export interface UpdateMeDto {
  name?: string;
  position?: string;
  phone?: string;
  workStatus?: string;
  department?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  companyId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  dateFrom?: string;
  dateTo?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  position: string | null;
  phone: string | null;
  workStatus: string | null;
  department: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  companyId: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  company: { id: string; legalName: string; type: string } | null;
  projects?: { id: string; name: string }[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedUsersResponse {
  items: UserResponse[];
  meta: PaginationMeta;
}

export async function getUsers(params?: UserListParams): Promise<PaginatedUsersResponse> {
  const { data } = await getApiClient().get<{ data: PaginatedUsersResponse }>(USERS_PATHS.ROOT, {
    params,
  });
  return data.data;
}

export async function createUser(
  dto: CreateUserDto,
  config?: AxiosRequestConfig,
): Promise<UserResponse> {
  const { data } = await getApiClient().post<{ data: UserResponse }>(USERS_PATHS.ROOT, dto, config);
  return data.data;
}

export async function getUser(id: string): Promise<UserResponse> {
  const { data } = await getApiClient().get<{ data: UserResponse }>(USERS_PATHS.byId(id));
  return data.data;
}

export async function updateUser(
  id: string,
  dto: UpdateUserDto,
  config?: AxiosRequestConfig,
): Promise<UserResponse> {
  const { data } = await getApiClient().patch<{ data: UserResponse }>(
    USERS_PATHS.byId(id),
    dto,
    config,
  );
  return data.data;
}

export async function deactivateUser(
  id: string,
  config?: AxiosRequestConfig,
): Promise<UserResponse> {
  const { data } = await getApiClient().patch<{ data: UserResponse }>(
    USERS_PATHS.deactivate(id),
    undefined,
    config,
  );
  return data.data;
}

export async function reactivateUser(
  id: string,
  config?: AxiosRequestConfig,
): Promise<UserResponse> {
  const { data } = await getApiClient().patch<{ data: UserResponse }>(
    USERS_PATHS.reactivate(id),
    undefined,
    config,
  );
  return data.data;
}

export async function resendInvitation(
  id: string,
  config?: AxiosRequestConfig,
): Promise<{ message: string }> {
  const { data } = await getApiClient().post<{ data: { message: string } }>(
    USERS_PATHS.resendInvitation(id),
    undefined,
    config,
  );
  return data.data;
}

export async function cancelInvitation(
  id: string,
  config?: AxiosRequestConfig,
): Promise<{ message: string }> {
  const { data } = await getApiClient().delete<{ data: { message: string } }>(
    USERS_PATHS.cancelInvitation(id),
    config,
  );
  return data.data;
}

export async function initiateResetPassword(id: string): Promise<{ message: string }> {
  const { data } = await getApiClient().post<{ data: { message: string } }>(
    USERS_PATHS.initiateResetPassword(id),
  );
  return data.data;
}

export async function getMe(config?: AxiosRequestConfig): Promise<UserResponse> {
  const { data } = await getApiClient().get<{ data: UserResponse }>(USERS_PATHS.ME, config);
  return data.data;
}

export async function updateMe(dto: UpdateMeDto): Promise<UserResponse> {
  const { data } = await getApiClient().patch<{ data: UserResponse }>(USERS_PATHS.ME, dto);
  return data.data;
}

export async function getMyAvatarUrl(): Promise<{ url: string | null }> {
  const { data } = await getApiClient().get<{ data: { url: string | null } }>(
    USERS_PATHS.ME_AVATAR_URL,
  );
  return data.data;
}

export async function uploadMyAvatar(file: File): Promise<{ id: string; avatarUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await getApiClient().post<{ data: { id: string; avatarUrl: string } }>(
    USERS_PATHS.ME_AVATAR,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

export async function changePassword(dto: ChangePasswordDto): Promise<{ message: string }> {
  const { data } = await getApiClient().post<{ data: { message: string } }>(
    USERS_PATHS.ME_CHANGE_PASSWORD,
    dto,
  );
  return data.data;
}
