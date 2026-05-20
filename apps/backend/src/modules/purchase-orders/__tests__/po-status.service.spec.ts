import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PoStatusService } from '../po-status.service';

const companyAdmin = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};
const superAdmin = {
  id: 'sa-1',
  email: 'sa@test.com',
  role: UserRole.SUPER_ADMIN,
  companyId: null,
};

const mockPrisma = {
  purchaseOrder: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const fullPoDetail = {
  id: 'po-new',
  poNumber: 'PO-ABCD1234',
  projectId: 'proj-1',
  status: 'DRAFT',
  poType: 'STANDARD',
  approvalStatus: 'NOT_REQUIRED',
  sourceOfCreation: 'MANUAL',
  revision: 1,
  priority: null,
  pickUp: false,
  holdForRelease: false,
  deliveryLocationId: 'loc-1',
  pickUpLocation: null,
  pickUpTimeExpectation: null,
  pickUpPersonName: null,
  pickUpPersonPhone: null,
  currency: 'AUD',
  subtotal: 500,
  discountAmount: null,
  taxAmount: null,
  totalAmount: 500,
  paymentTermsDays: 30,
  costCode: null,
  lineItemCount: 1,
  totalRequestedQty: 10,
  deadlineStart: null,
  deadlineEnd: null,
  plannedDeliveryDate: null,
  deliveryNotes: null,
  message: null,
  deliveryResponsibleName: null,
  deliveryResponsibleEmail: null,
  issuedAt: null,
  parentPoId: null,
  rfqId: null,
  createdAt: new Date('2026-03-01'),
  updatedAt: new Date('2026-03-01'),
  project: { name: 'Alpha' },
  vendor: { id: 'v-1', legalName: 'VendorCo' },
  company: { id: 'comp-1', legalName: 'TestCo' },
  createdBy: { id: 'ca-1', name: 'CA User' },
  approvedBy: null,
  lastModifiedBy: null,
  lineItems: [
    {
      id: 'li-1',
      lineNumber: 1,
      materialId: 'mat-1',
      material: { name: 'Steel' },
      materialCode: 'ST-01',
      description: 'Steel bars',
      quantityOrdered: 10,
      quantityDelivered: 0,
      unitOfMeasure: 'pcs',
      unitPrice: 50,
      lineTotal: 500,
      costCode: null,
      expectedDeliveryDate: null,
      deliveryLocationId: null,
      notes: null,
    },
  ],
  documents: [],
  invoices: [],
};

const mockPurchaseOrdersService = {
  getPurchaseOrder: jest.fn(),
};

const mockEmailService = {
  sendPoIssuedEmail: jest.fn(),
  sendPoDeclinedByVendorEmail: jest.fn(),
};

const mockPoExportService = {
  generatePoPdfBuffer: jest.fn(),
};

const mockConfig = {
  get: jest.fn((_key: string, fallback: string) => fallback),
};

describe('PoStatusService', () => {
  let service: PoStatusService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PoStatusService(
      mockPrisma as never,
      mockPurchaseOrdersService as never,
      mockEmailService as never,
      mockPoExportService as never,
      mockConfig as never,
    );
    // Default: getPurchaseOrder returns fullPoDetail-shaped response
    mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue(fullPoDetail);
  });

  describe('approvePurchaseOrder', () => {
    it('throws NotFoundException when PO does not exist', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.approvePurchaseOrder('missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user company does not match PO company', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'other-company',
      });

      await expect(service.approvePurchaseOrder('po-1', companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows SuperAdmin to approve PO from any company', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'any-company',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: 'ACKNOWLEDGED',
        project: { name: 'Alpha' },
        vendor: { legalName: 'VendorCo' },
      });

      const result = await service.approvePurchaseOrder('po-1', superAdmin);
      expect(result.status).toBe('ACKNOWLEDGED');
    });

    it('throws BadRequestException for invalid status (not DRAFT or SENT)', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'ACKNOWLEDGED',
        companyId: 'comp-1',
      });

      await expect(service.approvePurchaseOrder('po-1', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for CANCELLED status', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'CANCELLED',
        companyId: 'comp-1',
      });

      await expect(service.approvePurchaseOrder('po-1', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for CLOSED status', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'CLOSED',
        companyId: 'comp-1',
      });

      await expect(service.approvePurchaseOrder('po-1', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('approves a DRAFT PO successfully', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: 'ACKNOWLEDGED',
        project: { name: 'Alpha' },
        vendor: { legalName: 'VendorCo' },
      });

      const result = await service.approvePurchaseOrder('po-1', companyAdmin);
      expect(result.id).toBe('po-1');
      expect(result.status).toBe('ACKNOWLEDGED');
      expect(result.projectName).toBe('Alpha');
      expect(result.vendorName).toBe('VendorCo');

      // Verify update was called with correct data
      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'po-1' },
          data: {
            status: 'ACKNOWLEDGED',
            approvalStatus: 'APPROVED',
            approvedById: 'ca-1',
            lastModifiedById: 'ca-1',
          },
        }),
      );
    });

    it('approves a SENT PO successfully', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-2',
        status: 'SENT',
        companyId: 'comp-1',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-2',
        status: 'ACKNOWLEDGED',
        project: { name: 'Beta' },
        vendor: { legalName: 'SupplyCo' },
      });

      const result = await service.approvePurchaseOrder('po-2', companyAdmin);
      expect(result.status).toBe('ACKNOWLEDGED');
    });
  });

  describe('declinePurchaseOrder', () => {
    it('throws NotFoundException when PO does not exist', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.declinePurchaseOrder('missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user company does not match PO company', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'other-company',
      });

      await expect(service.declinePurchaseOrder('po-1', companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows SuperAdmin to decline PO from any company', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'SENT',
        companyId: 'any-company',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: 'CANCELLED',
        project: { name: 'Alpha' },
        vendor: { legalName: 'VendorCo' },
      });

      const result = await service.declinePurchaseOrder('po-1', superAdmin);
      expect(result.status).toBe('CANCELLED');
    });

    it('throws BadRequestException for CANCELLED status', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'CANCELLED',
        companyId: 'comp-1',
      });

      await expect(service.declinePurchaseOrder('po-1', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for CLOSED status', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'CLOSED',
        companyId: 'comp-1',
      });

      await expect(service.declinePurchaseOrder('po-1', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('declines a DRAFT PO successfully', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: 'CANCELLED',
        project: { name: 'Alpha' },
        vendor: { legalName: 'VendorCo' },
      });

      const result = await service.declinePurchaseOrder('po-1', companyAdmin);
      expect(result.id).toBe('po-1');
      expect(result.status).toBe('CANCELLED');
      expect(result.projectName).toBe('Alpha');
      expect(result.vendorName).toBe('VendorCo');

      // Verify update was called with correct data
      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'po-1' },
          data: {
            status: 'CANCELLED',
            approvalStatus: 'REJECTED',
            lastModifiedById: 'ca-1',
          },
        }),
      );
    });

    it('declines a SENT PO successfully', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-2',
        status: 'SENT',
        companyId: 'comp-1',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-2',
        status: 'CANCELLED',
        project: { name: 'Beta' },
        vendor: { legalName: 'SupplyCo' },
      });

      const result = await service.declinePurchaseOrder('po-2', companyAdmin);
      expect(result.status).toBe('CANCELLED');
    });

    it('declines an ACKNOWLEDGED PO successfully', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-3',
        status: 'ACKNOWLEDGED',
        companyId: 'comp-1',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-3',
        status: 'CANCELLED',
        project: { name: 'Gamma' },
        vendor: { legalName: 'BuildCo' },
      });

      const result = await service.declinePurchaseOrder('po-3', companyAdmin);
      expect(result.status).toBe('CANCELLED');
    });

    it('declines a SCHEDULED_FOR_DELIVERY PO successfully', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-4',
        status: 'SCHEDULED_FOR_DELIVERY',
        companyId: 'comp-1',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-4',
        status: 'CANCELLED',
        project: { name: 'Delta' },
        vendor: { legalName: 'MetalCo' },
      });

      const result = await service.declinePurchaseOrder('po-4', companyAdmin);
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('archivePurchaseOrder', () => {
    it('throws NotFoundException when PO does not exist', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.archivePurchaseOrder('missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user company does not match PO company', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'CLOSED',
        companyId: 'other-company',
      });

      await expect(service.archivePurchaseOrder('po-1', companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when PO is not CLOSED', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
      });

      await expect(service.archivePurchaseOrder('po-1', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('archives a CLOSED PO successfully', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'CLOSED',
        companyId: 'comp-1',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});

      const result = await service.archivePurchaseOrder('po-1', companyAdmin);
      expect(result).toEqual({ success: true });

      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: 'po-1' },
        data: { status: 'CANCELLED', lastModifiedById: 'ca-1' },
      });
    });

    it('allows SuperAdmin to archive PO from any company', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'CLOSED',
        companyId: 'any-company',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});

      const result = await service.archivePurchaseOrder('po-1', superAdmin);
      expect(result).toEqual({ success: true });
    });
  });

  describe('confirmPurchaseOrder', () => {
    const vendorUser = {
      id: 'v-u-1',
      email: 'vendor@test.com',
      role: UserRole.VENDOR,
      companyId: 'vendor-comp-1',
    };

    it('throws NotFoundException when PO not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.confirmPurchaseOrder('missing', vendorUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when vendor companyId does not match PO vendorId', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'SENT',
        vendorId: 'other-vendor',
      });
      await expect(service.confirmPurchaseOrder('po-1', vendorUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when PO is not SENT', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        vendorId: 'vendor-comp-1',
      });
      await expect(service.confirmPurchaseOrder('po-1', vendorUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('confirms PO successfully', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValueOnce({
        id: 'po-1',
        status: 'SENT',
        vendorId: 'vendor-comp-1',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue({
        id: 'po-1',
        status: 'ACKNOWLEDGED',
      });

      const result = await service.confirmPurchaseOrder('po-1', vendorUser);
      expect(result.status).toBe('ACKNOWLEDGED');
      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACKNOWLEDGED' }),
        }),
      );
    });
  });

  describe('acceptPurchaseOrder', () => {
    const vendorUser = {
      id: 'v-u-1',
      email: 'vendor@test.com',
      role: UserRole.VENDOR,
      companyId: 'vendor-comp-1',
    };

    it('throws NotFoundException when PO not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.acceptPurchaseOrder('missing', undefined, vendorUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when vendor companyId does not match PO vendorId', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'ACKNOWLEDGED',
        vendorId: 'other-vendor',
      });
      await expect(service.acceptPurchaseOrder('po-1', undefined, vendorUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when PO is not ACKNOWLEDGED', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'SENT',
        vendorId: 'vendor-comp-1',
      });
      await expect(service.acceptPurchaseOrder('po-1', undefined, vendorUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('accepts PO successfully', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'ACKNOWLEDGED',
        vendorId: 'vendor-comp-1',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue({
        id: 'po-1',
        status: 'ACCEPTED',
      });

      const result = await service.acceptPurchaseOrder('po-1', undefined, vendorUser);
      expect(result.status).toBe('ACCEPTED');
      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACCEPTED' }),
        }),
      );
    });

    it('accepts PO with optional payment terms', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'ACKNOWLEDGED',
        vendorId: 'vendor-comp-1',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue({
        id: 'po-1',
        status: 'ACCEPTED',
      });

      await service.acceptPurchaseOrder('po-1', { paymentTermsDays: 60 }, vendorUser);
      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paymentTermsDays: 60 }),
        }),
      );
    });
  });

  describe('vendorDeclinePurchaseOrder', () => {
    const vendorUser = {
      id: 'v-u-1',
      email: 'vendor@test.com',
      role: UserRole.VENDOR,
      companyId: 'vendor-comp-1',
    };

    const declinePoBase = {
      id: 'po-1',
      status: 'SENT',
      vendorId: 'vendor-comp-1',
      poNumber: 'PO-0001',
      companyId: 'comp-1',
      vendor: { legalName: 'VendorCo' },
      company: { users: [{ email: 'admin@contractor.com' }] },
    };

    it('throws NotFoundException when PO not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(
        service.vendorDeclinePurchaseOrder('missing', undefined, vendorUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when vendor companyId does not match PO vendorId', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...declinePoBase,
        vendorId: 'other-vendor',
      });
      await expect(
        service.vendorDeclinePurchaseOrder('po-1', undefined, vendorUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when PO is not SENT or ACKNOWLEDGED', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...declinePoBase,
        status: 'DRAFT',
      });
      await expect(
        service.vendorDeclinePurchaseOrder('po-1', undefined, vendorUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('declines SENT PO successfully', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(declinePoBase);
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue({
        id: 'po-1',
        status: 'CANCELLED_BY_VENDOR',
      });

      const result = await service.vendorDeclinePurchaseOrder('po-1', undefined, vendorUser);
      expect(result.status).toBe('CANCELLED_BY_VENDOR');
      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED_BY_VENDOR' }),
        }),
      );
    });

    it('declines ACKNOWLEDGED PO successfully', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...declinePoBase,
        status: 'ACKNOWLEDGED',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue({
        id: 'po-1',
        status: 'CANCELLED_BY_VENDOR',
      });

      const result = await service.vendorDeclinePurchaseOrder('po-1', undefined, vendorUser);
      expect(result.status).toBe('CANCELLED_BY_VENDOR');
    });

    it('stores reason when provided', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(declinePoBase);
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue({
        id: 'po-1',
        status: 'CANCELLED_BY_VENDOR',
      });

      await service.vendorDeclinePurchaseOrder('po-1', { reason: 'Out of stock' }, vendorUser);
      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deliveryNotes: 'Out of stock' }),
        }),
      );
    });

    it('sends decline email notification to contractor company admins', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(declinePoBase);
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue({
        id: 'po-1',
        status: 'CANCELLED_BY_VENDOR',
      });
      mockEmailService.sendPoDeclinedByVendorEmail.mockResolvedValue(undefined);

      await service.vendorDeclinePurchaseOrder('po-1', { reason: 'Out of stock' }, vendorUser);

      // Wait for fire-and-forget promise
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoDeclinedByVendorEmail).toHaveBeenCalledWith(
        'admin@contractor.com',
        'PO-0001',
        'VendorCo',
        'http://localhost:5179/purchase-orders/po-1',
        'Out of stock',
      );
    });

    it('does not send email when no company admins exist', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...declinePoBase,
        company: { users: [] },
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue({
        id: 'po-1',
        status: 'CANCELLED_BY_VENDOR',
      });

      await service.vendorDeclinePurchaseOrder('po-1', undefined, vendorUser);

      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoDeclinedByVendorEmail).not.toHaveBeenCalled();
    });

    it('does not fail when email sending throws', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(declinePoBase);
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue({
        id: 'po-1',
        status: 'CANCELLED_BY_VENDOR',
      });
      mockEmailService.sendPoDeclinedByVendorEmail.mockRejectedValue(new Error('SMTP down'));

      const result = await service.vendorDeclinePurchaseOrder(
        'po-1',
        { reason: 'No capacity' },
        vendorUser,
      );
      expect(result.status).toBe('CANCELLED_BY_VENDOR');
    });
  });

  describe('issuePurchaseOrder', () => {
    it('throws NotFoundException when PO not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.issuePurchaseOrder('missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user company does not match', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'other-company',
      });
      await expect(service.issuePurchaseOrder('po-1', companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when PO is not DRAFT', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'SENT',
        companyId: 'comp-1',
      });
      await expect(service.issuePurchaseOrder('po-1', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('issues a DRAFT PO successfully', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});

      const result = await service.issuePurchaseOrder('po-1', companyAdmin);
      expect(result.id).toBe('po-new');

      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'po-1' },
          data: expect.objectContaining({
            status: 'SENT',
            lastModifiedById: 'ca-1',
          }),
        }),
      );
    });

    it('allows SuperAdmin to issue PO from any company', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'any-company',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});

      const result = await service.issuePurchaseOrder('po-1', superAdmin);
      expect(result.id).toBe('po-new');
    });
  });
});
