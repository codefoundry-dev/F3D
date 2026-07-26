import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MaterialStatus, UserRole } from '@prisma/client';

import { MaterialStatusService } from '../material-status.service';
import { MaterialsService } from '../materials.service';

const mockPrisma = {
  material: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

// assertCanManageMaterial is pure (status + ownership only, no DB), so the
// collaborator delegates to the REAL implementation. Stubbing it would make the
// archive/restore ownership specs below assert against a stub that always passes.
const realMaterials = new MaterialsService(
  {} as never,
  {} as never,
  {
    get: (_key: string, fallback: string) => fallback,
  } as never,
);

const mockMaterialsService = {
  getMaterialById: jest.fn(),
  assertCanManageMaterial: (material: unknown, user: unknown) =>
    realMaterials.assertCanManageMaterial(material as never, user as never),
};

const superAdmin = {
  id: 'sa-1',
  email: 'sa@test.com',
  role: UserRole.SUPER_ADMIN,
  companyId: null,
};

const companyAdmin = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
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

    it('throws BadRequest when the material is neither PUBLIC nor PRIVATE', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.PENDING_APPROVAL,
        companyId: null,
      });
      await expect(service.archive('m-1', superAdmin)).rejects.toThrow(BadRequestException);
    });

    // A company can only retire a referenced material by archiving it, so PRIVATE
    // has to be an archivable source status.
    it('archives a company-owned PRIVATE row for its owner', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.PRIVATE,
        companyId: companyAdmin.companyId,
      });

      await service.archive('m-1', companyAdmin);

      expect(mockPrisma.material.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { status: MaterialStatus.ARCHIVED },
      });
    });

    it('403s a contractor archiving a PUBLIC row (public catalogue is read-only)', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.PUBLIC,
        companyId: null,
      });

      await expect(service.archive('m-1', companyAdmin)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.material.update).not.toHaveBeenCalled();
    });

    it("404s (no leak) a contractor archiving another company's PRIVATE row", async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.PRIVATE,
        companyId: 'other-co',
      });

      await expect(service.archive('m-1', companyAdmin)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.material.update).not.toHaveBeenCalled();
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

    it('moves an ARCHIVED company-owned row (company_id set) → PRIVATE', async () => {
      // A company-owned row restores into that company's own catalogue, not into
      // an approval queue — publishing to the public catalogue is deferred to v2.
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.ARCHIVED,
        companyId: 'comp-1',
      });

      await service.restore('m-1', superAdmin);

      expect(mockPrisma.material.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { status: MaterialStatus.PRIVATE },
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

    it('lets a company restore its OWN archived row back to PRIVATE', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.ARCHIVED,
        companyId: companyAdmin.companyId,
      });

      await service.restore('m-1', companyAdmin);

      expect(mockPrisma.material.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { status: MaterialStatus.PRIVATE },
      });
    });

    it('404s a contractor restoring an archived public row', async () => {
      // An ARCHIVED row with no owning company is invisible to a contractor, so a
      // 403 would acknowledge a material they should not know about.
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'm-1',
        status: MaterialStatus.ARCHIVED,
        companyId: null,
      });

      await expect(service.restore('m-1', companyAdmin)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.material.update).not.toHaveBeenCalled();
    });
  });
});
