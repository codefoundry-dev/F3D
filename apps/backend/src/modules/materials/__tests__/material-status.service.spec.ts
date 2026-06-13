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
    it('moves PENDING_APPROVAL → PUBLIC, clears company_id, and returns the refreshed detail', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.PENDING_APPROVAL,
      });

      const result = await service.approve('m-1', superAdmin);

      // Approval promotes a private contribution into the shared catalogue:
      // PUBLIC + company_id → null (US 4.02, via `company: { disconnect: true }`).
      expect(mockPrisma.material.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { status: MaterialStatus.PUBLIC, company: { disconnect: true } },
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
    it('moves an ARCHIVED public row (company_id null) → PUBLIC', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.ARCHIVED,
        companyId: null,
      });

      await service.restore('m-1', superAdmin);

      expect(mockPrisma.material.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { status: MaterialStatus.PUBLIC },
      });
    });

    it('moves an ARCHIVED private row (company_id set) → PENDING_APPROVAL (US 4.02)', async () => {
      // A company-private row still needs catalogue approval to go public, so it
      // restores back to the approval queue rather than straight to PUBLIC.
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.ARCHIVED,
        companyId: 'comp-1',
      });

      await service.restore('m-1', superAdmin);

      expect(mockPrisma.material.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { status: MaterialStatus.PENDING_APPROVAL },
      });
    });

    it('throws NotFound when the material does not exist', async () => {
      mockPrisma.material.findUnique.mockResolvedValue(null);
      await expect(service.restore('missing', superAdmin)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.material.update).not.toHaveBeenCalled();
    });

    it('throws BadRequest when the material is not ARCHIVED', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.PUBLIC,
        companyId: null,
      });
      await expect(service.restore('m-1', superAdmin)).rejects.toThrow(BadRequestException);
    });
  });
});
