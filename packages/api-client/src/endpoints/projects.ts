import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { PROJECTS_PATHS } from './paths';
import type { PaginationMeta } from './users';

// ── Request interfaces ───────────────────────────────────────────────────────

export interface ProjectLocationInput {
  type: 'DELIVERY' | 'STORAGE';
  address: string;
  label?: string;
  isDefault: boolean;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  type?: string;
  status?: string;
  locations: ProjectLocationInput[];
  assignedUserIds: string[];
  plannedBudget?: number;
  currency?: string;
  pointOfContactId?: string;
  startDate?: string;
  expectedEndDate?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  type?: string;
  status?: string;
  locations?: ProjectLocationInput[];
  assignedUserIds?: string[];
  plannedBudget?: number;
  currency?: string;
  pointOfContactId?: string;
  startDate?: string;
  expectedEndDate?: string;
}

export interface AddProjectMembersInput {
  userIds: string[];
}

export interface ProjectListParams {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

// ── Response interfaces ──────────────────────────────────────────────────────

export interface ProjectLocationResponse {
  id: string;
  type: 'DELIVERY' | 'STORAGE';
  address: string;
  label: string | null;
  isDefault: boolean;
}

export interface ProjectMemberResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  /** Profile photo URL, null when the user has not uploaded one. */
  avatarUrl: string | null;
  /** Contact phone, null when not provided. */
  phone: string | null;
  /** Account status (UserStatus enum value, e.g. ACTIVE / DEACTIVATED). */
  status: string;
  /** Optional presence/work status driving the avatar status dot. */
  workStatus: string | null;
  assignedAt: string;
  assignedBy?: { id: string; name: string };
}

export interface UserRef {
  id: string;
  name: string;
}

/** Lightweight member shape used to render the avatar stack on the list. */
export interface ProjectMemberAvatar {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ProjectListItem {
  id: string;
  /** Human-readable project code, e.g. "PRJ-2025-001". */
  code: string;
  name: string;
  description: string | null;
  status: string;
  type: string | null;
  defaultDeliveryLocation: string;
  defaultStorageLocation: string;
  memberCount: number;
  /** First few members for the avatar stack; full count in memberCount. */
  memberAvatars: ProjectMemberAvatar[];
  startDate: string | null;
  expectedEndDate: string | null;
  createdAt: string;
}

export interface ProjectDetail {
  id: string;
  /** Human-readable project code, e.g. "PRJ-2025-001". */
  code: string;
  name: string;
  description: string | null;
  status: string;
  type: string | null;
  locations: ProjectLocationResponse[];
  assignedUsers: ProjectMemberResponse[];
  plannedBudget: number | null;
  usedBudget: number;
  currency: string;
  startDate: string | null;
  expectedEndDate: string | null;
  pointOfContact: UserRef | null;
  createdBy: UserRef;
  createdAt: string;
  updatedAt: string;
  activeBom: null;
  rfqCount: number;
  poCount: number;
  invoiceCount: number;
  vendorCount: number;
}

export interface PaginatedProjectsResponse {
  items: ProjectListItem[];
  meta: PaginationMeta;
}

export interface ProjectMembersResponse {
  members: ProjectMemberResponse[];
}

// ── Endpoint functions ───────────────────────────────────────────────────────

export async function getProjects(
  params?: ProjectListParams,
  config?: AxiosRequestConfig,
): Promise<PaginatedProjectsResponse> {
  const { data } = await getApiClient().get<{ data: PaginatedProjectsResponse }>(
    PROJECTS_PATHS.ROOT,
    { params, ...config },
  );
  return data.data;
}

export async function createProject(
  dto: CreateProjectInput,
  config?: AxiosRequestConfig,
): Promise<ProjectDetail> {
  const { data } = await getApiClient().post<{ data: ProjectDetail }>(
    PROJECTS_PATHS.ROOT,
    dto,
    config,
  );
  return data.data;
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const { data } = await getApiClient().get<{ data: ProjectDetail }>(PROJECTS_PATHS.byId(id));
  return data.data;
}

export async function updateProject(
  id: string,
  dto: UpdateProjectInput,
  config?: AxiosRequestConfig,
): Promise<ProjectDetail> {
  const { data } = await getApiClient().patch<{ data: ProjectDetail }>(
    PROJECTS_PATHS.byId(id),
    dto,
    config,
  );
  return data.data;
}

export async function addProjectMembers(
  id: string,
  dto: AddProjectMembersInput,
): Promise<ProjectMembersResponse> {
  const { data } = await getApiClient().post<{ data: ProjectMembersResponse }>(
    PROJECTS_PATHS.members(id),
    dto,
  );
  return data.data;
}

export async function removeProjectMember(
  id: string,
  userId: string,
): Promise<ProjectMembersResponse> {
  const { data } = await getApiClient().delete<{ data: ProjectMembersResponse }>(
    PROJECTS_PATHS.member(id, userId),
  );
  return data.data;
}
