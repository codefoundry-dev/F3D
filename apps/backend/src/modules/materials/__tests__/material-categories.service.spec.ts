import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { MaterialCategoriesService } from '../material-categories.service';

const mockPrisma = {
  materialCategory: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const row = (over: Record<string, unknown> = {}) => ({
  id: 'cat-1',
  name: 'Steel',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { materials: 2 },
  ...over,
});

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

describe('MaterialCategoriesService', () => {
  let service: MaterialCategoriesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MaterialCategoriesService(mockPrisma as never);
  });

  describe('listCategories', () => {
    it('returns every category with its active flag and material count', async () => {
      mockPrisma.materialCategory.findMany.mockResolvedValue([
        row(),
        row({ id: 'cat-2', name: 'Timber', isActive: false, _count: { materials: 0 } }),
      ]);

      await expect(service.listCategories()).resolves.toEqual([
        { id: 'cat-1', name: 'Steel', isActive: true, materialCount: 2 },
        { id: 'cat-2', name: 'Timber', isActive: false, materialCount: 0 },
      ]);
      expect(mockPrisma.materialCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });
  });

  describe('createCategory', () => {
    it('trims and collapses whitespace before creating', async () => {
      mockPrisma.materialCategory.findFirst.mockResolvedValue(null);
      mockPrisma.materialCategory.create.mockResolvedValue(
        row({ id: 'cat-9', name: 'Pipe Fittings', _count: { materials: 0 } }),
      );

      const result = await service.createCategory({ name: '  Pipe   Fittings ' });

      expect(mockPrisma.materialCategory.create.mock.calls[0][0].data).toEqual({
        name: 'Pipe Fittings',
      });
      expect(result).toEqual({
        id: 'cat-9',
        name: 'Pipe Fittings',
        isActive: true,
        materialCount: 0,
      });
    });

    it('rejects a blank name', async () => {
      await expect(service.createCategory({ name: '   ' })).rejects.toThrow(BadRequestException);
      expect(mockPrisma.materialCategory.create).not.toHaveBeenCalled();
    });

    it('rejects a case-insensitive duplicate', async () => {
      mockPrisma.materialCategory.findFirst.mockResolvedValue({ id: 'cat-1' });

      await expect(service.createCategory({ name: 'steel' })).rejects.toThrow(ConflictException);
      expect(mockPrisma.materialCategory.findFirst.mock.calls[0][0].where.name).toEqual({
        equals: 'steel',
        mode: 'insensitive',
      });
    });

    it('maps a racing unique violation to 409', async () => {
      mockPrisma.materialCategory.findFirst.mockResolvedValue(null);
      mockPrisma.materialCategory.create.mockRejectedValue(uniqueViolation());

      await expect(service.createCategory({ name: 'Steel' })).rejects.toThrow(ConflictException);
    });
  });

  describe('updateCategory', () => {
    it('404s for an unknown category', async () => {
      mockPrisma.materialCategory.findUnique.mockResolvedValue(null);
      await expect(service.updateCategory('nope', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('renames after checking the new name is free (excluding itself)', async () => {
      mockPrisma.materialCategory.findUnique.mockResolvedValue(row());
      mockPrisma.materialCategory.findFirst.mockResolvedValue(null);
      mockPrisma.materialCategory.update.mockResolvedValue(row({ name: 'Structural Steel' }));

      const result = await service.updateCategory('cat-1', { name: 'Structural Steel' });

      expect(mockPrisma.materialCategory.findFirst.mock.calls[0][0].where.id).toEqual({
        not: 'cat-1',
      });
      expect(mockPrisma.materialCategory.update.mock.calls[0][0].data).toEqual({
        name: 'Structural Steel',
      });
      expect(result.name).toBe('Structural Steel');
    });

    it('allows a casing-only rename without a duplicate check', async () => {
      mockPrisma.materialCategory.findUnique.mockResolvedValue(row());
      mockPrisma.materialCategory.update.mockResolvedValue(row({ name: 'STEEL' }));

      await service.updateCategory('cat-1', { name: 'STEEL' });

      expect(mockPrisma.materialCategory.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.materialCategory.update.mock.calls[0][0].data).toEqual({ name: 'STEEL' });
    });

    it('rejects a rename onto another category name', async () => {
      mockPrisma.materialCategory.findUnique.mockResolvedValue(row());
      mockPrisma.materialCategory.findFirst.mockResolvedValue({ id: 'cat-2' });

      await expect(service.updateCategory('cat-1', { name: 'Timber' })).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.materialCategory.update).not.toHaveBeenCalled();
    });

    it('deactivates and reactivates', async () => {
      mockPrisma.materialCategory.findUnique.mockResolvedValue(row());
      mockPrisma.materialCategory.update.mockResolvedValue(row({ isActive: false }));

      const result = await service.updateCategory('cat-1', { isActive: false });

      expect(mockPrisma.materialCategory.update.mock.calls[0][0].data).toEqual({
        isActive: false,
      });
      expect(result.isActive).toBe(false);
    });

    it('protects the Uncategorised fallback from rename and deactivation', async () => {
      mockPrisma.materialCategory.findUnique.mockResolvedValue(row({ name: 'Uncategorised' }));

      await expect(service.updateCategory('cat-1', { name: 'Misc' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateCategory('cat-1', { isActive: false })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.materialCategory.update).not.toHaveBeenCalled();
    });
  });

  describe('assertAssignable', () => {
    it('returns the id of an active category', async () => {
      mockPrisma.materialCategory.findUnique.mockResolvedValue(row());
      await expect(service.assertAssignable('cat-1')).resolves.toBe('cat-1');
    });

    it('404s for an unknown category', async () => {
      mockPrisma.materialCategory.findUnique.mockResolvedValue(null);
      await expect(service.assertAssignable('nope')).rejects.toThrow(NotFoundException);
    });

    it('rejects an inactive category unless the material already uses it', async () => {
      mockPrisma.materialCategory.findUnique.mockResolvedValue(row({ isActive: false }));
      await expect(service.assertAssignable('cat-1')).rejects.toThrow(BadRequestException);
      await expect(service.assertAssignable('cat-1', 'cat-1')).resolves.toBe('cat-1');
    });
  });
});
