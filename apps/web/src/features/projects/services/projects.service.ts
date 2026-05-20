import {
  getProjects,
  createProject,
  getProject,
  updateProject,
  addProjectMembers,
  removeProjectMember,
  getUsers,
  type ProjectListParams,
  type CreateProjectInput,
  type UpdateProjectInput,
  type AddProjectMembersInput,
} from '@forethread/api-client';
import { UserStatus } from '@forethread/shared-types/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useAuthStore } from '@/features/auth/state/auth.store';

export function useProjects(params?: ProjectListParams) {
  return useQuery({
    queryKey: ['projects', params],
    queryFn: () => getProjects(params, { skipErrorHandler: true }),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => getProject(id),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (dto: CreateProjectInput) => createProject(dto, { skipErrorHandler: true }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate(ROUTES.projectDetail.replace(':id', data.id));
    },
  });
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateProjectInput) => updateProject(id, dto, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['projects', id] });
    },
  });
}

export function useAddProjectMembers(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: AddProjectMembersInput) => addProjectMembers(projectId, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    },
  });
}

export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => removeProjectMember(projectId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    },
  });
}

export function useCompanyUsers() {
  const companyId = useAuthStore((s) => s.currentUser?.companyId);

  return useQuery({
    queryKey: ['users', { companyId, status: UserStatus.ACTIVE }],
    queryFn: () => getUsers({ companyId: companyId ?? '', status: UserStatus.ACTIVE, limit: 100 }),
    enabled: !!companyId,
    select: (data) => data.items,
  });
}
