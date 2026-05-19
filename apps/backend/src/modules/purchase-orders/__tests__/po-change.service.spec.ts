import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PoChangeService } from '../po-change.service';

const companyAdmin = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};

const vendorUser = {
  id: 'v-u-1',
  email: 'vendor@test.com',
  role: UserRole.VENDOR,
  companyId: 'vendor-comp-1',
};

const mockPrisma = {
  purchaseOrder: { findUnique: jest.fn() },
  poChangeRequest: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: { findUnique: jest.fn() },
};

const mockAuditService = { log: jest.fn() };

const mockEmailService = {
  sendChangeRequestProposedEmail: jest.fn(),
  sendChangeRequestApprovedEmail: jest.fn(),
  sendChangeRequestRejectedEmail: jest.fn(),
};

const mockConfig = {
  get: jest.fn((_key: string, fallback: string) => fallback),
};

describe('PoChangeService', () => {
  let service: PoChangeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PoChangeService(
      mockPrisma as never,
      mockAuditService as never,
      mockEmailService as never,
      mockConfig as never,
    );
    mockEmailService.sendChangeRequestProposedEmail.mockResolvedValue(undefined);
    mockEmailService.sendChangeRequestApprovedEmail.mockResolvedValue(undefined);
    mockEmailService.sendChangeRequestRejectedEmail.mockResolvedValue(undefined);
    mockAuditService.log.mockResolvedValue(undefined);
  });

  // ── proposeChange ─────────────────────────────────────────────────────────

  describe('proposeChange', () => {
    const poWithRelations = {
      id: 'po-1',
      status: 'SENT',
      companyId: 'comp-1',
      vendorId: 'vendor-comp-1',
      poNumber: 'PO-0001',
      company: { users: [{ email: 'admin@contractor.com' }] },
      vendor: { users: [{ email: 'vendor@vendor.com' }] },
    };

    const dto = {
      changeType: 'COMMERCIAL',
      changedFields: { paymentTermsDays: 60 },
    };

    it('throws NotFoundException when PO not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.proposeChange('missing', dto as never, vendorUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when vendor user does not belong to PO vendor', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...poWithRelations,
        vendorId: 'other-vendor',
      });
      await expect(service.proposeChange('po-1', dto as never, vendorUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when PO status is not allowed', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...poWithRelations,
        status: 'CANCELLED',
      });
      await expect(service.proposeChange('po-1', dto as never, companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates change request and logs audit', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poChangeRequest.create.mockResolvedValue({
        id: 'cr-1',
        requestedBy: { id: 'v-u-1', name: 'Vendor User' },
      });

      const result = await service.proposeChange('po-1', dto as never, vendorUser);

      expect(result.id).toBe('cr-1');
      expect(mockPrisma.poChangeRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            purchaseOrderId: 'po-1',
            changeType: 'COMMERCIAL',
            requestedById: 'v-u-1',
          }),
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PO_CHANGE_PROPOSED' }),
      );
    });

    it('sends email to contractor when vendor proposes a change', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poChangeRequest.create.mockResolvedValue({
        id: 'cr-1',
        requestedBy: { id: 'v-u-1', name: 'Vendor User' },
      });

      await service.proposeChange('po-1', dto as never, vendorUser);

      // Wait for fire-and-forget
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendChangeRequestProposedEmail).toHaveBeenCalledWith(
        'admin@contractor.com',
        'PO-0001',
        'Vendor User',
        'http://localhost:3002/purchase-orders/po-1',
      );
    });

    it('sends email to vendor when contractor proposes a change', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poChangeRequest.create.mockResolvedValue({
        id: 'cr-1',
        requestedBy: { id: 'ca-1', name: 'CA Admin' },
      });

      await service.proposeChange('po-1', dto as never, companyAdmin);

      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendChangeRequestProposedEmail).toHaveBeenCalledWith(
        'vendor@vendor.com',
        'PO-0001',
        'CA Admin',
        'http://localhost:3003/purchase-orders/po-1',
      );
    });

    it('does not fail when email sending throws', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poChangeRequest.create.mockResolvedValue({
        id: 'cr-1',
        requestedBy: { id: 'v-u-1', name: 'Vendor User' },
      });
      mockEmailService.sendChangeRequestProposedEmail.mockRejectedValue(new Error('SMTP down'));

      const result = await service.proposeChange('po-1', dto as never, vendorUser);
      expect(result.id).toBe('cr-1');
    });
  });

  // ── listChangeRequests ────────────────────────────────────────────────────

  describe('listChangeRequests', () => {
    it('throws NotFoundException when PO not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.listChangeRequests('missing', vendorUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns change requests for the PO', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        companyId: 'comp-1',
        vendorId: 'vendor-comp-1',
      });
      mockPrisma.poChangeRequest.findMany.mockResolvedValue([{ id: 'cr-1' }, { id: 'cr-2' }]);

      const result = await service.listChangeRequests('po-1', vendorUser);
      expect(result).toHaveLength(2);
    });
  });

  // ── approveChange ─────────────────────────────────────────────────────────

  describe('approveChange', () => {
    it('throws NotFoundException when change request not found', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(null);
      await expect(service.approveChange('po-1', 'cr-missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when change request is not PENDING', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        requestedById: 'v-u-1',
        status: 'APPROVED',
      });
      await expect(service.approveChange('po-1', 'cr-1', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ForbiddenException when approving own change request', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        requestedById: 'ca-1',
        status: 'PENDING',
      });
      await expect(service.approveChange('po-1', 'cr-1', companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('approves change request and logs audit', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        requestedById: 'v-u-1',
        status: 'PENDING',
      });
      mockPrisma.poChangeRequest.update.mockResolvedValue({});

      const result = await service.approveChange('po-1', 'cr-1', companyAdmin);

      expect(result).toEqual({ approved: true });
      expect(mockPrisma.poChangeRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cr-1' },
          data: expect.objectContaining({ approvedById: 'ca-1' }),
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PO_CHANGE_APPROVED' }),
      );
    });

    it('sends approved email to the change requester', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        requestedById: 'v-u-1',
        status: 'PENDING',
      });
      mockPrisma.poChangeRequest.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'vendor@test.com',
        role: UserRole.VENDOR,
      });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ poNumber: 'PO-0001' });

      await service.approveChange('po-1', 'cr-1', companyAdmin);

      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendChangeRequestApprovedEmail).toHaveBeenCalledWith(
        'vendor@test.com',
        'PO-0001',
        'http://localhost:3003/purchase-orders/po-1',
      );
    });

    it('sends approved email with company admin URL when requester is not vendor', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        requestedById: 'ca-1',
      });

      // The test will throw ForbiddenException since ca-1 cannot approve own CR
      // so test with a different approver
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        requestedById: 'ca-other',
        status: 'PENDING',
      });
      mockPrisma.poChangeRequest.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'other-admin@contractor.com',
        role: UserRole.COMPANY_ADMIN,
      });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ poNumber: 'PO-0002' });

      await service.approveChange('po-1', 'cr-1', companyAdmin);

      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendChangeRequestApprovedEmail).toHaveBeenCalledWith(
        'other-admin@contractor.com',
        'PO-0002',
        'http://localhost:3002/purchase-orders/po-1',
      );
    });
  });

  // ── rejectChange ──────────────────────────────────────────────────────────

  describe('rejectChange', () => {
    it('throws NotFoundException when change request not found', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(null);
      await expect(
        service.rejectChange('po-1', 'cr-missing', { reason: 'No' }, companyAdmin),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when change request is not PENDING', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        requestedById: 'v-u-1',
        status: 'REJECTED',
      });
      await expect(
        service.rejectChange('po-1', 'cr-1', { reason: 'No' }, companyAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when rejecting own change request', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        requestedById: 'ca-1',
        status: 'PENDING',
      });
      await expect(
        service.rejectChange('po-1', 'cr-1', { reason: 'No' }, companyAdmin),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects change request and logs audit with reason', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        requestedById: 'v-u-1',
        status: 'PENDING',
      });
      mockPrisma.poChangeRequest.update.mockResolvedValue({});

      const result = await service.rejectChange(
        'po-1',
        'cr-1',
        { reason: 'Terms unacceptable' },
        companyAdmin,
      );

      expect(result).toEqual({ rejected: true });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PO_CHANGE_REJECTED',
          metadata: { changeRequestId: 'cr-1', reason: 'Terms unacceptable' },
        }),
      );
    });

    it('sends rejected email to the change requester', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        requestedById: 'v-u-1',
        status: 'PENDING',
      });
      mockPrisma.poChangeRequest.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'vendor@test.com',
        role: UserRole.VENDOR,
      });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ poNumber: 'PO-0001' });

      await service.rejectChange('po-1', 'cr-1', { reason: 'No' }, companyAdmin);

      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendChangeRequestRejectedEmail).toHaveBeenCalledWith(
        'vendor@test.com',
        'PO-0001',
        'http://localhost:3003/purchase-orders/po-1',
      );
    });

    it('does not fail when email sending throws', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        requestedById: 'v-u-1',
        status: 'PENDING',
      });
      mockPrisma.poChangeRequest.update.mockResolvedValue({});
      mockEmailService.sendChangeRequestRejectedEmail.mockRejectedValue(new Error('SMTP down'));

      const result = await service.rejectChange('po-1', 'cr-1', { reason: 'No' }, companyAdmin);
      expect(result).toEqual({ rejected: true });
    });
  });
});
