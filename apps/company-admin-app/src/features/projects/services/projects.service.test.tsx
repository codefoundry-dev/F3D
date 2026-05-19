const mockApiClient = vi.hoisted(() => ({
  getProjects: vi.fn(),
  createProject: vi.fn(),
  getProject: vi.fn(),
  updateProject: vi.fn(),
  addProjectMembers: vi.fn(),
  removeProjectMember: vi.fn(),
  getUsers: vi.fn(),
}));

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => ({
  ...mockApiClient,
  UserStatus: { ACTIVE: 'ACTIVE' },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ currentUser: { companyId: 'company-1' } }),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useAddProjectMembers,
  useRemoveProjectMember,
  useCompanyUsers,
} from './projects.service';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('projects.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useProjects', () => {
    it('calls getProjects with params and returns data', async () => {
      const mockData = { items: [{ id: '1', name: 'Project A' }], meta: { total: 1 } };
      mockApiClient.getProjects.mockResolvedValue(mockData);

      const { result } = renderHook(() => useProjects({ page: 1, limit: 25 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.getProjects).toHaveBeenCalledWith(
        { page: 1, limit: 25 },
        { skipErrorHandler: true },
      );
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useProject', () => {
    it('calls getProject with id and returns data', async () => {
      const mockProject = { id: 'p1', name: 'Test Project' };
      mockApiClient.getProject.mockResolvedValue(mockProject);

      const { result } = renderHook(() => useProject('p1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.getProject).toHaveBeenCalledWith('p1');
      expect(result.current.data).toEqual(mockProject);
    });

    it('does not call getProject when id is empty', () => {
      renderHook(() => useProject(''), { wrapper: createWrapper() });
      expect(mockApiClient.getProject).not.toHaveBeenCalled();
    });
  });

  describe('useCreateProject', () => {
    it('calls createProject and navigates on success', async () => {
      const created = { id: 'new-1' };
      mockApiClient.createProject.mockResolvedValue(created);

      const { result } = renderHook(() => useCreateProject(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        name: 'New Project',
        status: 'PLANNED',
        currency: 'AUD',
        locations: [],
        assignedUserIds: [],
      } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.createProject).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Project' }),
        { skipErrorHandler: true },
      );
      expect(mockNavigate).toHaveBeenCalledWith('/projects/new-1');
    });
  });

  describe('useUpdateProject', () => {
    it('calls updateProject with id and dto', async () => {
      mockApiClient.updateProject.mockResolvedValue({});

      const { result } = renderHook(() => useUpdateProject('p1'), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ name: 'Updated' } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.updateProject).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ name: 'Updated' }),
        { skipErrorHandler: true },
      );
    });
  });

  describe('useAddProjectMembers', () => {
    it('calls addProjectMembers with projectId and dto', async () => {
      mockApiClient.addProjectMembers.mockResolvedValue({});

      const { result } = renderHook(() => useAddProjectMembers('p1'), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ userIds: ['u1', 'u2'] });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.addProjectMembers).toHaveBeenCalledWith('p1', { userIds: ['u1', 'u2'] });
    });
  });

  describe('useRemoveProjectMember', () => {
    it('calls removeProjectMember with projectId and userId', async () => {
      mockApiClient.removeProjectMember.mockResolvedValue({});

      const { result } = renderHook(() => useRemoveProjectMember('p1'), {
        wrapper: createWrapper(),
      });

      result.current.mutate('u1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.removeProjectMember).toHaveBeenCalledWith('p1', 'u1');
    });
  });

  describe('useCompanyUsers', () => {
    it('calls getUsers with companyId and Active status', async () => {
      const mockResponse = { items: [{ id: 'u1', name: 'User 1' }] };
      mockApiClient.getUsers.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useCompanyUsers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.getUsers).toHaveBeenCalledWith({
        companyId: 'company-1',
        status: 'ACTIVE',
        limit: 100,
      });
      // select: (data) => data.items
      expect(result.current.data).toEqual([{ id: 'u1', name: 'User 1' }]);
    });
  });
});
