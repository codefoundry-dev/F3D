import { NotFoundException } from '@nestjs/common';

import { ViewsService } from '../views.service';

const mockPrisma = {
  userTableView: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

describe('ViewsService', () => {
  let service: ViewsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ViewsService(mockPrisma as never);
  });

  describe('listViews', () => {
    it('returns mapped views', async () => {
      mockPrisma.userTableView.findMany.mockResolvedValue([
        {
          id: 'v-1',
          name: 'My View',
          tableName: 'rfqs',
          visibleColumns: ['col1'],
          columnOrder: ['col1'],
          sortBy: 'name',
          sortDir: 'asc',
          quickFilter: null,
          groupBy: null,
          createdAt: new Date('2026-03-01'),
        },
      ]);

      const result = await service.listViews('user-1', 'rfqs');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('v-1');
      expect(result[0].createdAt).toBe('2026-03-01T00:00:00.000Z');
      expect(mockPrisma.userTableView.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', tableName: 'rfqs' },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('returns empty array when no views', async () => {
      mockPrisma.userTableView.findMany.mockResolvedValue([]);
      const result = await service.listViews('user-1', 'rfqs');
      expect(result).toEqual([]);
    });
  });

  describe('createView', () => {
    it('creates a view with defaults', async () => {
      mockPrisma.userTableView.create.mockResolvedValue({
        id: 'v-1',
        name: 'New View',
        tableName: 'rfqs',
        visibleColumns: [],
        columnOrder: [],
        sortBy: undefined,
        sortDir: undefined,
        quickFilter: undefined,
        groupBy: undefined,
        createdAt: new Date('2026-03-01'),
      });

      const result = await service.createView('user-1', {
        name: 'New View',
        tableName: 'rfqs',
      });

      expect(result.id).toBe('v-1');
      expect(result.name).toBe('New View');
      expect(mockPrisma.userTableView.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          name: 'New View',
          tableName: 'rfqs',
          visibleColumns: [],
          columnOrder: [],
        }),
      });
    });

    it('creates a view with all options', async () => {
      mockPrisma.userTableView.create.mockResolvedValue({
        id: 'v-2',
        name: 'Full View',
        tableName: 'invoices',
        visibleColumns: ['a', 'b'],
        columnOrder: ['b', 'a'],
        sortBy: 'date',
        sortDir: 'desc',
        quickFilter: 'pending',
        groupBy: 'status',
        createdAt: new Date('2026-03-01'),
      });

      const result = await service.createView('user-1', {
        name: 'Full View',
        tableName: 'invoices',
        visibleColumns: ['a', 'b'],
        columnOrder: ['b', 'a'],
        sortBy: 'date',
        sortDir: 'desc',
        quickFilter: 'pending',
        groupBy: 'status',
      });

      expect(result.visibleColumns).toEqual(['a', 'b']);
      expect(result.sortBy).toBe('date');
      expect(result.groupBy).toBe('status');
    });
  });

  describe('updateView', () => {
    it('updates an existing view', async () => {
      mockPrisma.userTableView.findFirst.mockResolvedValue({ id: 'v-1' });
      mockPrisma.userTableView.update.mockResolvedValue({
        id: 'v-1',
        name: 'Updated',
        tableName: 'rfqs',
        visibleColumns: ['x'],
        columnOrder: [],
        sortBy: null,
        sortDir: null,
        quickFilter: null,
        groupBy: null,
        createdAt: new Date('2026-03-01'),
      });

      const result = await service.updateView('user-1', 'v-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('throws NotFoundException when view not found', async () => {
      mockPrisma.userTableView.findFirst.mockResolvedValue(null);
      await expect(service.updateView('user-1', 'v-999', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('applies partial updates correctly', async () => {
      mockPrisma.userTableView.findFirst.mockResolvedValue({ id: 'v-1' });
      mockPrisma.userTableView.update.mockResolvedValue({
        id: 'v-1',
        name: 'Old',
        tableName: 'rfqs',
        visibleColumns: ['a'],
        columnOrder: [],
        sortBy: null,
        sortDir: null,
        quickFilter: 'test',
        groupBy: null,
        createdAt: new Date('2026-03-01'),
      });

      await service.updateView('user-1', 'v-1', {
        quickFilter: 'test',
        sortBy: null,
        sortDir: null,
      });

      const updateCall = mockPrisma.userTableView.update.mock.calls[0][0];
      expect(updateCall.data).toHaveProperty('quickFilter');
      expect(updateCall.data).toHaveProperty('sortBy');
    });

    it('updates all optional fields', async () => {
      mockPrisma.userTableView.findFirst.mockResolvedValue({ id: 'v-1' });
      mockPrisma.userTableView.update.mockResolvedValue({
        id: 'v-1',
        name: 'Full Update',
        tableName: 'rfqs',
        visibleColumns: ['a', 'b'],
        columnOrder: ['b', 'a'],
        sortBy: 'date',
        sortDir: 'desc',
        quickFilter: 'all',
        groupBy: 'status',
        createdAt: new Date('2026-03-01'),
      });

      await service.updateView('user-1', 'v-1', {
        name: 'Full Update',
        visibleColumns: ['a', 'b'],
        columnOrder: ['b', 'a'],
        sortBy: 'date',
        sortDir: 'desc',
        quickFilter: 'all',
        groupBy: 'status',
      });

      const updateCall = mockPrisma.userTableView.update.mock.calls[0][0];
      expect(updateCall.data.name).toBe('Full Update');
      expect(updateCall.data.visibleColumns).toEqual(['a', 'b']);
      expect(updateCall.data.columnOrder).toEqual(['b', 'a']);
      expect(updateCall.data.sortBy).toBe('date');
      expect(updateCall.data.sortDir).toBe('desc');
      expect(updateCall.data.quickFilter).toBe('all');
      expect(updateCall.data.groupBy).toBe('status');
    });
  });

  describe('deleteView', () => {
    it('deletes an existing view', async () => {
      mockPrisma.userTableView.findFirst.mockResolvedValue({ id: 'v-1' });
      mockPrisma.userTableView.delete.mockResolvedValue({});

      await service.deleteView('user-1', 'v-1');
      expect(mockPrisma.userTableView.delete).toHaveBeenCalledWith({ where: { id: 'v-1' } });
    });

    it('throws NotFoundException when view not found', async () => {
      mockPrisma.userTableView.findFirst.mockResolvedValue(null);
      await expect(service.deleteView('user-1', 'v-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAllViews', () => {
    it('deletes all views for user and table', async () => {
      mockPrisma.userTableView.deleteMany.mockResolvedValue({ count: 3 });

      await service.deleteAllViews('user-1', 'rfqs');
      expect(mockPrisma.userTableView.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', tableName: 'rfqs' },
      });
    });
  });
});
