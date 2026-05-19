import { ProjectsController } from '../projects.controller';

const mockProjectsService = {
  listProjects: jest.fn(),
  createProject: jest.fn(),
  getProject: jest.fn(),
  updateProject: jest.fn(),
  addMembers: jest.fn(),
  removeMember: jest.fn(),
};

const mockUser = {
  id: 'user-1',
  email: 'u@test.com',
  role: 'COMPANY_ADMIN',
  companyId: 'c-1',
};

describe('ProjectsController', () => {
  let controller: ProjectsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProjectsController(mockProjectsService as never);
  });

  describe('listProjects', () => {
    it('delegates to service', async () => {
      const query = { page: 1, limit: 25 };
      mockProjectsService.listProjects.mockResolvedValue({ items: [], meta: {} });
      const result = await controller.listProjects(query as never, mockUser as never);
      expect(result).toEqual({ items: [], meta: {} });
      expect(mockProjectsService.listProjects).toHaveBeenCalledWith(query, mockUser);
    });
  });

  describe('createProject', () => {
    it('delegates to service', async () => {
      const dto = { name: 'Test Project' };
      mockProjectsService.createProject.mockResolvedValue({ id: 'p-1' });
      const result = await controller.createProject(dto as never, mockUser as never);
      expect(result).toEqual({ id: 'p-1' });
      expect(mockProjectsService.createProject).toHaveBeenCalledWith(dto, mockUser);
    });
  });

  describe('getProject', () => {
    it('delegates to service', async () => {
      mockProjectsService.getProject.mockResolvedValue({ id: 'p-1', name: 'Test' });
      const result = await controller.getProject('p-1');
      expect(result).toEqual({ id: 'p-1', name: 'Test' });
      expect(mockProjectsService.getProject).toHaveBeenCalledWith('p-1');
    });
  });

  describe('updateProject', () => {
    it('delegates to service', async () => {
      const dto = { name: 'Updated' };
      mockProjectsService.updateProject.mockResolvedValue({ id: 'p-1', name: 'Updated' });
      const result = await controller.updateProject('p-1', dto as never, mockUser as never);
      expect(result).toEqual({ id: 'p-1', name: 'Updated' });
      expect(mockProjectsService.updateProject).toHaveBeenCalledWith('p-1', dto, mockUser);
    });
  });

  describe('addMembers', () => {
    it('delegates to service', async () => {
      const dto = { userIds: ['u-1', 'u-2'] };
      mockProjectsService.addMembers.mockResolvedValue({ added: 2 });
      const result = await controller.addMembers('p-1', dto as never, mockUser as never);
      expect(result).toEqual({ added: 2 });
      expect(mockProjectsService.addMembers).toHaveBeenCalledWith('p-1', ['u-1', 'u-2'], mockUser);
    });
  });

  describe('removeMember', () => {
    it('delegates to service', async () => {
      mockProjectsService.removeMember.mockResolvedValue({ removed: true });
      const result = await controller.removeMember('p-1', 'u-1', mockUser as never);
      expect(result).toEqual({ removed: true });
      expect(mockProjectsService.removeMember).toHaveBeenCalledWith('p-1', 'u-1', mockUser);
    });
  });

  describe('getBom', () => {
    it('returns not implemented stub', () => {
      const result = controller.getBom();
      expect(result).toEqual({ success: false, error: 'BOM management is not yet available' });
    });
  });

  describe('createBom', () => {
    it('returns not implemented stub', () => {
      const result = controller.createBom();
      expect(result).toEqual({ success: false, error: 'BOM management is not yet available' });
    });
  });
});
