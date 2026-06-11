import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MaterialStatus, UserRole } from '@prisma/client';

import { MaterialStatusService } from '../material-status.service';

const mockPrisma = {
  material: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockMaterialsService = {
  getMaterialById: jest.fn(),
};

const superAdmin = {
  id: 'sa-1',
  email: 'sa@test.com',
  role: UserRole.SUPER_ADMIN,
  companyId: null,
};

describe('MaterialStatusService', () => {
  let service: MaterialStatusService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MaterialStatusService(mockPrisma as never, mockMaterialsService as never);
    mockMaterialsService.getMaterialById.mockResolvedValue({ id: 'm-1' });
    mockPrisma.material.update.mockResolvedValue({});
  });

  // ── approve ───────────────────────────────────────────────────────────────

  describe('approve', () => {
    it('moves PENDING_APPROVAL → PUBLIC and returns the refreshed detail', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.PENDING_APPROVAL,
      });

      const result = await service.approve('m-1', superAdmin);

      expect(mockPrisma.material.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { status: MaterialStatus.PUBLIC },
      });
      expect(mockMaterialsService.getMaterialById).toHaveBeenCalledWith('m-1', superAdmin);
      expect(result).toEqual({ id: 'm-1' });
    });

    it('throws NotFound when the material does not exist', async () => {
      mockPrisma.material.findUnique.mockResolvedValue(null);
      await expect(service.approve('missing', superAdmin)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.material.update).not.toHaveBeenCalled();
    });

    it('throws BadRequest when the material is not PENDING_APPROVAL', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.PUBLIC,
      });
      await expect(service.approve('m-1', superAdmin)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.material.update).not.toHaveBeenCalled();
    });
  });

  // ── reject ────────────────────────────────────────────────────────────────

  describe('reject', () => {
    it('moves PENDING_APPROVAL → ARCHIVED (reason is accepted but not persisted)', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.PENDING_APPROVAL,
      });

      await service.reject('m-1', { reason: 'Bad data' }, superAdmin);

      expect(mockPrisma.material.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { status: MaterialStatus.ARCHIVED },
      });
    });

    it('throws BadRequest when the material is not PENDING_APPROVAL', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.ARCHIVED,
      });
      await expect(service.reject('m-1', undefined, superAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── archive ───────────────────────────────────────────────────────────────

  describe('archive', () => {
    it('moves PUBLIC → ARCHIVED', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.PUBLIC,
      });

      await service.archive('m-1', superAdmin);

      expect(mockPrisma.material.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { status: MaterialStatus.ARCHIVED },
      });
    });

    it('throws BadRequest when the material is not PUBLIC', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.PENDING_APPROVAL,
      });
      await expect(service.archive('m-1', superAdmin)).rejects.toThrow(BadRequestException);
    });
  });

  // ── restore ───────────────────────────────────────────────────────────────

  describe('restore', () => {
    it('moves ARCHIVED → PUBLIC', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.ARCHIVED,
      });

      await service.restore('m-1', superAdmin);

      expect(mockPrisma.material.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { status: MaterialStatus.PUBLIC },
      });
    });

    it('throws BadRequest when the material is not ARCHIVED', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.PUBLIC,
      });
      await expect(service.restore('m-1', superAdmin)).rejects.toThrow(BadRequestException);
    });
  });
});
