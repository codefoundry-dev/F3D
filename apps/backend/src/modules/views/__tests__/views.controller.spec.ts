import { ViewsController } from '../views.controller';

const mockViewsService = {
  listViews: jest.fn(),
  createView: jest.fn(),
  updateView: jest.fn(),
  deleteView: jest.fn(),
  deleteAllViews: jest.fn(),
};

const mockUser = { id: 'user-1', email: 'u@test.com', role: 'COMPANY_ADMIN', companyId: 'c-1' };

describe('ViewsController', () => {
  let controller: ViewsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ViewsController(mockViewsService as never);
  });

  describe('listViews', () => {
    it('returns views array directly (interceptor wraps)', async () => {
      mockViewsService.listViews.mockResolvedValue([{ id: 'v-1' }]);
      const result = await controller.listViews('rfqs', mockUser as never);
      expect(result).toEqual([{ id: 'v-1' }]);
      expect(mockViewsService.listViews).toHaveBeenCalledWith('user-1', 'rfqs');
    });
  });

  describe('createView', () => {
    it('returns view object directly (interceptor wraps)', async () => {
      mockViewsService.createView.mockResolvedValue({ id: 'v-1' });
      const body = { name: 'Test', tableName: 'rfqs' };
      const result = await controller.createView(body, mockUser as never);
      expect(result).toEqual({ id: 'v-1' });
      expect(mockViewsService.createView).toHaveBeenCalledWith('user-1', body);
    });
  });

  describe('updateView', () => {
    it('returns view object directly (interceptor wraps)', async () => {
      mockViewsService.updateView.mockResolvedValue({ id: 'v-1', name: 'Updated' });
      const body = { name: 'Updated' };
      const result = await controller.updateView('v-1', body, mockUser as never);
      expect(result).toEqual({ id: 'v-1', name: 'Updated' });
      expect(mockViewsService.updateView).toHaveBeenCalledWith('user-1', 'v-1', body);
    });
  });

  describe('deleteView', () => {
    it('returns message', async () => {
      mockViewsService.deleteView.mockResolvedValue(undefined);
      const result = await controller.deleteView('v-1', mockUser as never);
      expect(result).toEqual({ message: 'View deleted' });
      expect(mockViewsService.deleteView).toHaveBeenCalledWith('user-1', 'v-1');
    });
  });

  describe('deleteAllViews', () => {
    it('returns message', async () => {
      mockViewsService.deleteAllViews.mockResolvedValue(undefined);
      const result = await controller.deleteAllViews('rfqs', mockUser as never);
      expect(result).toEqual({ message: 'All views deleted' });
      expect(mockViewsService.deleteAllViews).toHaveBeenCalledWith('user-1', 'rfqs');
    });
  });
});
