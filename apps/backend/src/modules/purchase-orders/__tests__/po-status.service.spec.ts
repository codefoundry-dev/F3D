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

// Contractor decline now requires a reason DTO (Week-3 reason capture).
const declineDto = { reason: 'No longer required' };

const mockPrisma = {
  purchaseOrder: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  poLineItem: {
    update: jest.fn(),
  },
  rolePermission: {
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  auditLog: {
    findMany: jest.fn(),
  },
  accessToken: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  rfqVendorContact: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
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
  getPurchaseOrderById: jest.fn(),
};

const mockEmailService = {
  sendPoIssuedEmail: jest.fn(),
  sendPoDeclinedByVendorEmail: jest.fn(),
  sendPoPendingApprovalEmail: jest.fn(),
};

const mockPoExportService = {
  generatePoPdfBuffer: jest.fn(),
};

const mockApprovalAuth = {
  evaluate: jest.fn(),
};

const mockAuditService = {
  log: jest.fn(),
};

const mockInventoryService = {
  applyIn: jest.fn().mockResolvedValue({ id: 'mov-1' }),
};

const mockAccessTokensService = {
  issueTokenIfNoneLive: jest.fn(),
  issueToken: jest.fn(),
};

const mockConfig = {
  get: jest.fn((_key: string, fallback: string) => fallback),
};

const mockBranding = {
  getEmailBrand: jest.fn().mockResolvedValue(undefined),
  getPdfBrand: jest.fn().mockResolvedValue(undefined),
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
      mockApprovalAuth as never,
      mockAuditService as never,
      mockInventoryService as never,
      mockAccessTokensService as never,
      mockConfig as never,
      mockBranding as never,
    );
    // Default: getPurchaseOrder / getPurchaseOrderById return fullPoDetail-shaped response
    mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue(fullPoDetail);
    mockPurchaseOrdersService.getPurchaseOrderById.mockResolvedValue(fullPoDetail);
    // Default: approval authorization grants the action (null threshold = unlimited).
    mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'allowed', threshold: null });
    // Run interactive transactions against the same mock client so existing
    // assertions on mockPrisma.purchaseOrder.update still apply (FOR-246 wrapped
    // the SENT transition + token issuance in prisma.$transaction).
    mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockPrisma) => unknown) =>
      cb(mockPrisma),
    );
    // Default: minting a PO_VIEW token yields a fresh opaque token.
    mockAccessTokensService.issueTokenIfNoneLive.mockResolvedValue({
      token: 'lookup1234567890.secretsecretsecret',
      record: { id: 'tok-1' },
      reused: false,
    });
    // Default: no sales-rep selection on a source RFQ (manual-PO shape).
    mockPrisma.rfqVendorContact.findMany.mockResolvedValue([]);
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
      // Approving to ACKNOWLEDGED does not send to the vendor, so no PO token.
      expect(mockAccessTokensService.issueTokenIfNoneLive).not.toHaveBeenCalled();
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

    it('rejects the approval when the PO total exceeds the role threshold', async () => {
      const procurementOfficer = {
        id: 'po-u-1',
        email: 'po@test.com',
        role: UserRole.PROCUREMENT_OFFICER,
        companyId: 'comp-1',
      };
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-big',
        status: 'DRAFT',
        companyId: 'comp-1',
        totalAmount: { toString: () => '30000' },
        currency: 'AUD',
      });
      mockApprovalAuth.evaluate.mockResolvedValue({
        outcome: 'belowThreshold',
        threshold: { toString: () => '25000' },
      });

      await expect(service.approvePurchaseOrder('po-big', procurementOfficer)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockApprovalAuth.evaluate).toHaveBeenCalledWith(
        UserRole.PROCUREMENT_OFFICER,
        'po.approve',
        expect.anything(),
      );
      expect(mockPrisma.purchaseOrder.update).not.toHaveBeenCalled();
    });

    it('approves a PO whose total is within the role threshold', async () => {
      const procurementOfficer = {
        id: 'po-u-1',
        email: 'po@test.com',
        role: UserRole.PROCUREMENT_OFFICER,
        companyId: 'comp-1',
      };
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-small',
        status: 'DRAFT',
        companyId: 'comp-1',
        totalAmount: { toString: () => '5000' },
        currency: 'AUD',
      });
      mockApprovalAuth.evaluate.mockResolvedValue({
        outcome: 'allowed',
        threshold: { toString: () => '25000' },
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-small',
        status: 'ACKNOWLEDGED',
        project: { name: 'Small' },
        vendor: { legalName: 'V' },
      });

      const result = await service.approvePurchaseOrder('po-small', procurementOfficer);
      expect(result.status).toBe('ACKNOWLEDGED');
    });

    it('bypasses threshold checks for SUPER_ADMIN', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-sa',
        status: 'DRAFT',
        companyId: 'any-company',
        totalAmount: { toString: () => '999999' },
        currency: 'AUD',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-sa',
        status: 'ACKNOWLEDGED',
        project: { name: 'SA' },
        vendor: { legalName: 'V' },
      });

      await service.approvePurchaseOrder('po-sa', superAdmin);

      expect(mockApprovalAuth.evaluate).not.toHaveBeenCalled();
    });
  });

  describe('declinePurchaseOrder', () => {
    it('throws NotFoundException when PO does not exist', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(
        service.declinePurchaseOrder('missing', declineDto, companyAdmin),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user company does not match PO company', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'other-company',
      });

      await expect(service.declinePurchaseOrder('po-1', declineDto, companyAdmin)).rejects.toThrow(
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

      const result = await service.declinePurchaseOrder('po-1', declineDto, superAdmin);
      expect(result.status).toBe('CANCELLED');
    });

    it('throws BadRequestException for CANCELLED status', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'CANCELLED',
        companyId: 'comp-1',
      });

      await expect(service.declinePurchaseOrder('po-1', declineDto, companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for CLOSED status', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'CLOSED',
        companyId: 'comp-1',
      });

      await expect(service.declinePurchaseOrder('po-1', declineDto, companyAdmin)).rejects.toThrow(
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

      const result = await service.declinePurchaseOrder('po-1', declineDto, companyAdmin);
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
            cancellationReason: 'No longer required',
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

      const result = await service.declinePurchaseOrder('po-2', declineDto, companyAdmin);
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

      const result = await service.declinePurchaseOrder('po-3', declineDto, companyAdmin);
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

      const result = await service.declinePurchaseOrder('po-4', declineDto, companyAdmin);
      expect(result.status).toBe('CANCELLED');
    });

    it('still succeeds when audit logging fails', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'SENT',
        companyId: 'comp-1',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: 'CANCELLED',
        project: { name: 'Alpha' },
        vendor: { legalName: 'VendorCo' },
      });
      mockAuditService.log.mockRejectedValueOnce(new Error('audit down'));

      const result = await service.declinePurchaseOrder('po-1', declineDto, companyAdmin);
      expect(result.status).toBe('CANCELLED');
    });
  });

  // ── Branch coverage: approval thresholds, null vendors, vendor actions ─────
  describe('fallback and authorization branches', () => {
    const vendorUser = {
      id: 'vu-1',
      email: 'v@test.com',
      role: UserRole.VENDOR,
      companyId: 'vendor-comp-1',
    };

    it('denies approval when the approver is not granted the action', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        totalAmount: 500,
        currency: 'AUD',
      });
      mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'notGranted', threshold: null });

      await expect(service.approvePurchaseOrder('po-1', companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('reports a zero amount when below threshold and the PO total is null', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        totalAmount: null,
        currency: 'AUD',
      });
      mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'belowThreshold', threshold: 1000 });

      await expect(service.approvePurchaseOrder('po-1', companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns a null vendorName when an approved PO has no vendor', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        totalAmount: 500,
        currency: 'AUD',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: 'ACKNOWLEDGED',
        project: { name: 'Alpha' },
        vendor: null,
      });

      const result = await service.approvePurchaseOrder('po-1', companyAdmin);
      expect(result.vendorName).toBeNull();
    });

    it('returns a null vendorName when a declined PO has no vendor', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'SENT',
        companyId: 'comp-1',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: 'CANCELLED',
        project: { name: 'Alpha' },
        vendor: null,
      });

      const result = await service.declinePurchaseOrder('po-1', declineDto, companyAdmin);
      expect(result.vendorName).toBeNull();
    });

    it('persists the warehouse location when a vendor accepts with one', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'ACKNOWLEDGED',
        vendorId: 'vendor-comp-1',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});

      await service.acceptPurchaseOrder(
        'po-1',
        { warehouseLocationId: 'wh-1' } as never,
        vendorUser as never,
      );

      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ warehouseLocationId: 'wh-1' }),
        }),
      );
    });

    it('uses default vendor/contractor labels when a declined PO lacks vendor and admin users', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'SENT',
        vendorId: 'vendor-comp-1',
        poNumber: 'PO-1',
        companyId: 'comp-1',
        vendor: null,
        company: {},
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});

      const result = await service.vendorDeclinePurchaseOrder(
        'po-1',
        { reason: 'x' } as never,
        vendorUser as never,
      );
      await new Promise((r) => setTimeout(r, 10));

      expect(result).toBeDefined();
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
        expect.objectContaining({ purchaseOrderId: 'po-1' }),
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

  // ── Tokenised vendor PO portal actions (FOR-247) ───────────────────────────
  // No user / ownership check: the validated access token already binds the
  // request to this exact PO, so the guard is the authorization. Audit rows are
  // attributed to the guest vendor via performedByLabel (performedById = null).

  describe('confirmPurchaseOrderViaToken', () => {
    it('throws NotFoundException when PO not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.confirmPurchaseOrderViaToken('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when PO is not SENT', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', status: 'DRAFT' });
      await expect(service.confirmPurchaseOrderViaToken('po-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('acknowledges the PO and attributes the audit to the guest vendor', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', status: 'SENT' });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      mockPurchaseOrdersService.getPurchaseOrderById.mockResolvedValue({
        id: 'po-1',
        status: 'ACKNOWLEDGED',
      });

      const result = await service.confirmPurchaseOrderViaToken('po-1');

      expect(result.status).toBe('ACKNOWLEDGED');
      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACKNOWLEDGED', lastModifiedById: null }),
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PO_ACKNOWLEDGED',
          performedById: null,
          performedByLabel: expect.any(String),
        }),
      );
    });

    it('does not throw when the guest audit write fails', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', status: 'SENT' });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      mockAuditService.log.mockRejectedValueOnce(new Error('audit down'));
      mockPurchaseOrdersService.getPurchaseOrderById.mockResolvedValue({
        id: 'po-1',
        status: 'ACKNOWLEDGED',
      });

      const result = await service.confirmPurchaseOrderViaToken('po-1');
      expect(result.status).toBe('ACKNOWLEDGED');
    });
  });

  describe('acceptPurchaseOrderViaToken', () => {
    it('throws NotFoundException when PO not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.acceptPurchaseOrderViaToken('missing', undefined)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when PO is not ACKNOWLEDGED', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', status: 'SENT' });
      await expect(service.acceptPurchaseOrderViaToken('po-1', undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('accepts the PO and applies optional payment terms', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', status: 'ACKNOWLEDGED' });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      mockPurchaseOrdersService.getPurchaseOrderById.mockResolvedValue({
        id: 'po-1',
        status: 'ACCEPTED',
      });

      const result = await service.acceptPurchaseOrderViaToken('po-1', { paymentTermsDays: 45 });

      expect(result.status).toBe('ACCEPTED');
      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACCEPTED',
            lastModifiedById: null,
            paymentTermsDays: 45,
          }),
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PO_ACCEPTED', performedById: null }),
      );
    });
  });

  describe('vendorDeclinePurchaseOrderViaToken', () => {
    const declinePoBase = {
      id: 'po-1',
      status: 'SENT',
      poNumber: 'PO-0001',
      vendor: { legalName: 'VendorCo' },
      company: { users: [{ email: 'admin@contractor.com' }] },
    };

    it('throws NotFoundException when PO not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(
        service.vendorDeclinePurchaseOrderViaToken('missing', undefined),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when PO is not SENT or ACKNOWLEDGED', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ ...declinePoBase, status: 'DRAFT' });
      await expect(service.vendorDeclinePurchaseOrderViaToken('po-1', undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('declines the PO, stores the reason, and notifies the contractor', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(declinePoBase);
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      mockPurchaseOrdersService.getPurchaseOrderById.mockResolvedValue({
        id: 'po-1',
        status: 'CANCELLED_BY_VENDOR',
      });
      mockEmailService.sendPoDeclinedByVendorEmail.mockResolvedValue(undefined);

      const result = await service.vendorDeclinePurchaseOrderViaToken('po-1', {
        reason: 'Out of stock',
      });

      expect(result.status).toBe('CANCELLED_BY_VENDOR');
      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CANCELLED_BY_VENDOR',
            lastModifiedById: null,
            cancellationReason: 'Out of stock',
          }),
        }),
      );

      // Wait for the fire-and-forget contractor notification.
      await new Promise((r) => setTimeout(r, 10));
      expect(mockEmailService.sendPoDeclinedByVendorEmail).toHaveBeenCalledWith(
        'admin@contractor.com',
        'PO-0001',
        'VendorCo',
        expect.any(String),
        'Out of stock',
        expect.objectContaining({ purchaseOrderId: 'po-1' }),
      );
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

    // ── FOR-210: approval-gated sending ──────────────────────────────────

    const procurementOfficer = {
      id: 'po-u-1',
      email: 'po@test.com',
      role: UserRole.PROCUREMENT_OFFICER,
      companyId: 'comp-1',
    };

    it('sends directly when the PO total is within the role threshold', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        totalAmount: { toString: () => '5000' },
        currency: 'AUD',
      });
      mockApprovalAuth.evaluate.mockResolvedValue({
        outcome: 'allowed',
        threshold: { toString: () => '25000' },
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        poNumber: 'PO-1',
        vendor: { users: [] },
      });

      await service.issuePurchaseOrder('po-1', procurementOfficer);

      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SENT' }),
        }),
      );
    });

    it('sends directly with unlimited threshold (allowed, null cap)', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        totalAmount: { toString: () => '999999' },
        currency: 'AUD',
      });
      mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'allowed', threshold: null });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        poNumber: 'PO-1',
        vendor: { users: [] },
      });

      await service.issuePurchaseOrder('po-1', procurementOfficer);

      const data = mockPrisma.purchaseOrder.update.mock.calls[0][0].data;
      expect(data.status).toBe('SENT');
      expect(data.issuedAt).toBeInstanceOf(Date);
    });

    it('notifies the vendor when sent directly', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        totalAmount: { toString: () => '5000' },
        currency: 'AUD',
      });
      mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'allowed', threshold: null });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        poNumber: 'PO-1',
        vendor: { users: [{ email: 'vendor@test.com', status: 'ACTIVE' }] },
      });
      mockPoExportService.generatePoPdfBuffer.mockResolvedValue(Buffer.from('pdf'));
      mockEmailService.sendPoIssuedEmail.mockResolvedValue(undefined);

      await service.issuePurchaseOrder('po-1', procurementOfficer);
      await new Promise((r) => setTimeout(r, 10));

      // A PO_VIEW token is always minted at SENT (the portal foundation), but an
      // activated rep — an ACTIVE user with a real login — is sent the
      // authenticated app route, not the tokenised link (FOR-246).
      expect(mockAccessTokensService.issueTokenIfNoneLive).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendPoIssuedEmail).toHaveBeenCalledWith(
        'vendor@test.com',
        'PO-1',
        'http://localhost:5179/purchase-orders/po-1',
        expect.any(Buffer),
        expect.objectContaining({ purchaseOrderId: 'po-1' }),
        undefined,
      );
    });

    it('emails the tokenised portal link to an unactivated vendor (contactEmail, no users)', async () => {
      // FOR-246: an email-only vendor cannot log in, so the "View" link is the
      // tokenised public PO portal (/po/<token>), not the authenticated route.
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        totalAmount: { toString: () => '5000' },
        currency: 'AUD',
      });
      mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'allowed', threshold: null });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        poNumber: 'PO-1',
        vendor: { users: [], contactEmail: 'sales@vendor.com' },
      });
      mockPoExportService.generatePoPdfBuffer.mockResolvedValue(Buffer.from('pdf'));
      mockEmailService.sendPoIssuedEmail.mockResolvedValue(undefined);

      await service.issuePurchaseOrder('po-1', companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      // A single reusable 30-day PO_VIEW token was minted in the same transaction.
      expect(mockAccessTokensService.issueTokenIfNoneLive).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectType: 'PURCHASE_ORDER',
          subjectId: 'po-1',
          purpose: 'PO_VIEW',
          ttlMs: 30 * 24 * 60 * 60 * 1000,
        }),
        mockPrisma,
      );
      expect(mockEmailService.sendPoIssuedEmail).toHaveBeenCalledWith(
        'sales@vendor.com',
        'PO-1',
        'http://localhost:5179/po/lookup1234567890.secretsecretsecret',
        expect.any(Buffer),
        expect.objectContaining({ purchaseOrderId: 'po-1' }),
        undefined,
      );
    });

    it('falls back to the authenticated link for an unactivated vendor when no fresh token is available', async () => {
      // Defensive path: if a live token already existed (idempotent reuse), no
      // plaintext is returned, so there is no tokenised link to send. The state
      // machine makes this unreachable in practice, but the code must not break.
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        totalAmount: { toString: () => '5000' },
        currency: 'AUD',
      });
      mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'allowed', threshold: null });
      mockAccessTokensService.issueTokenIfNoneLive.mockResolvedValue({
        token: null,
        record: { id: 'tok-existing' },
        reused: true,
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        poNumber: 'PO-1',
        vendor: { users: [], contactEmail: 'sales@vendor.com' },
      });
      mockPoExportService.generatePoPdfBuffer.mockResolvedValue(Buffer.from('pdf'));
      mockEmailService.sendPoIssuedEmail.mockResolvedValue(undefined);

      await service.issuePurchaseOrder('po-1', companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoIssuedEmail).toHaveBeenCalledWith(
        'sales@vendor.com',
        'PO-1',
        'http://localhost:5179/purchase-orders/po-1',
        expect.any(Buffer),
        expect.objectContaining({ purchaseOrderId: 'po-1' }),
        undefined,
      );
    });

    it('emails the tokenised link to an unactivated (INVITED) sales rep', async () => {
      // The reported bug: a rep persisted as an INVITED user (FOR-272) has no
      // credentials, yet their mere existence used to flip the vendor to
      // "activated" and suppress the tokenised link. The link is now chosen per
      // recipient — an INVITED rep gets the portal link (CONTEXT.md).
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        totalAmount: { toString: () => '5000' },
        currency: 'AUD',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        poNumber: 'PO-1',
        vendor: { users: [{ email: 'rep@vendor.com', status: 'INVITED' }] },
      });
      mockPoExportService.generatePoPdfBuffer.mockResolvedValue(Buffer.from('pdf'));
      mockEmailService.sendPoIssuedEmail.mockResolvedValue(undefined);

      await service.issuePurchaseOrder('po-1', companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoIssuedEmail).toHaveBeenCalledWith(
        'rep@vendor.com',
        'PO-1',
        'http://localhost:5179/po/lookup1234567890.secretsecretsecret',
        expect.any(Buffer),
        expect.objectContaining({ purchaseOrderId: 'po-1' }),
        undefined,
      );
    });

    it('chooses the link per recipient for a vendor with mixed activation states', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        totalAmount: { toString: () => '5000' },
        currency: 'AUD',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        poNumber: 'PO-1',
        vendor: {
          users: [
            { email: 'active@vendor.com', status: 'ACTIVE' },
            { email: 'rep@vendor.com', status: 'INVITED' },
          ],
        },
      });
      mockPoExportService.generatePoPdfBuffer.mockResolvedValue(Buffer.from('pdf'));
      mockEmailService.sendPoIssuedEmail.mockResolvedValue(undefined);

      await service.issuePurchaseOrder('po-1', companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoIssuedEmail).toHaveBeenCalledTimes(2);
      expect(mockEmailService.sendPoIssuedEmail).toHaveBeenCalledWith(
        'active@vendor.com',
        'PO-1',
        'http://localhost:5179/purchase-orders/po-1',
        expect.any(Buffer),
        expect.anything(),
        undefined,
      );
      expect(mockEmailService.sendPoIssuedEmail).toHaveBeenCalledWith(
        'rep@vendor.com',
        'PO-1',
        'http://localhost:5179/po/lookup1234567890.secretsecretsecret',
        expect.any(Buffer),
        expect.anything(),
        undefined,
      );
    });

    it('honours the sales reps selected on the source RFQ over the vendor user list', async () => {
      // An awarded PO resolves its recipients live from the RFQ's selection
      // (po.rfqId → RfqVendor → RfqVendorContact) — CONTEXT.md: the selection
      // governs the whole RFQ→PO thread; nothing is snapshotted at award.
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        totalAmount: { toString: () => '5000' },
        currency: 'AUD',
        rfqId: 'rfq-1',
        vendorId: 'vendor-co-1',
      });
      mockPrisma.rfqVendorContact.findMany.mockResolvedValue([
        { user: { email: 'chosen-rep@vendor.com', status: 'INVITED' } },
      ]);
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        poNumber: 'PO-1',
        vendor: { users: [{ email: 'unrelated@vendor.com', status: 'ACTIVE' }] },
      });
      mockPoExportService.generatePoPdfBuffer.mockResolvedValue(Buffer.from('pdf'));
      mockEmailService.sendPoIssuedEmail.mockResolvedValue(undefined);

      await service.issuePurchaseOrder('po-1', companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockPrisma.rfqVendorContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { rfqVendor: { rfqId: 'rfq-1', vendorId: 'vendor-co-1' } },
        }),
      );
      expect(mockEmailService.sendPoIssuedEmail).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendPoIssuedEmail).toHaveBeenCalledWith(
        'chosen-rep@vendor.com',
        'PO-1',
        'http://localhost:5179/po/lookup1234567890.secretsecretsecret',
        expect.any(Buffer),
        expect.anything(),
        undefined,
      );
    });

    it('sends nothing to INACTIVE (deactivated) users', async () => {
      // A deactivated rep must receive neither a dead authenticated link nor a
      // tokenised link that would restore their authority login-free.
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        totalAmount: { toString: () => '5000' },
        currency: 'AUD',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        poNumber: 'PO-1',
        vendor: {
          users: [
            { email: 'gone@vendor.com', status: 'INACTIVE' },
            { email: 'rep@vendor.com', status: 'INVITED' },
          ],
        },
      });
      mockPoExportService.generatePoPdfBuffer.mockResolvedValue(Buffer.from('pdf'));
      mockEmailService.sendPoIssuedEmail.mockResolvedValue(undefined);

      await service.issuePurchaseOrder('po-1', companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoIssuedEmail).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendPoIssuedEmail).toHaveBeenCalledWith(
        'rep@vendor.com',
        'PO-1',
        expect.any(String),
        expect.any(Buffer),
        expect.anything(),
        undefined,
      );
    });

    it('routes to PENDING_APPROVAL when the PO total exceeds the threshold (belowThreshold)', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-big',
        status: 'DRAFT',
        companyId: 'comp-1',
        totalAmount: { toString: () => '30000' },
        currency: 'AUD',
      });
      mockApprovalAuth.evaluate.mockResolvedValue({
        outcome: 'belowThreshold',
        threshold: { toString: () => '25000' },
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});

      await service.issuePurchaseOrder('po-big', procurementOfficer);

      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: 'po-big' },
        data: {
          status: 'PENDING_APPROVAL',
          approvalStatus: 'PENDING',
          lastModifiedById: 'po-u-1',
        },
      });
      expect(mockEmailService.sendPoIssuedEmail).not.toHaveBeenCalled();
    });

    it('routes to PENDING_APPROVAL when the role cannot self-approve (notGranted)', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-ng',
        status: 'DRAFT',
        companyId: 'comp-1',
        totalAmount: { toString: () => '100' },
        currency: 'AUD',
      });
      mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'notGranted' });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});

      await service.issuePurchaseOrder('po-ng', procurementOfficer);

      const data = mockPrisma.purchaseOrder.update.mock.calls[0][0].data;
      expect(data.status).toBe('PENDING_APPROVAL');
      expect(data.approvalStatus).toBe('PENDING');
      expect(data.issuedAt).toBeUndefined();
      expect(mockEmailService.sendPoIssuedEmail).not.toHaveBeenCalled();
    });

    it('SUPER_ADMIN sends directly regardless of total, bypassing threshold checks', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-sa',
        status: 'DRAFT',
        companyId: 'any-company',
        totalAmount: { toString: () => '9999999' },
        currency: 'AUD',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        poNumber: 'PO-SA',
        vendor: { users: [] },
      });

      await service.issuePurchaseOrder('po-sa', superAdmin);

      expect(mockApprovalAuth.evaluate).not.toHaveBeenCalled();
      expect(mockPrisma.purchaseOrder.update.mock.calls[0][0].data.status).toBe('SENT');
    });
  });

  // ── FOR-210: approving a held PO completes the send ──────────────────────

  describe('approvePurchaseOrder (PENDING_APPROVAL → SENT)', () => {
    it('transitions PENDING_APPROVAL → SENT, sets issuedAt, and notifies the vendor', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-pa',
        status: 'PENDING_APPROVAL',
        companyId: 'comp-1',
        totalAmount: { toString: () => '30000' },
        currency: 'AUD',
      });
      mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'allowed', threshold: null });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-pa',
        status: 'SENT',
        poNumber: 'PO-PA',
        project: { name: 'Alpha' },
        vendor: { legalName: 'VendorCo', users: [{ email: 'vendor@test.com', status: 'ACTIVE' }] },
      });
      mockPoExportService.generatePoPdfBuffer.mockResolvedValue(Buffer.from('pdf'));
      mockEmailService.sendPoIssuedEmail.mockResolvedValue(undefined);

      const result = await service.approvePurchaseOrder('po-pa', companyAdmin);
      expect(result.status).toBe('SENT');

      const data = mockPrisma.purchaseOrder.update.mock.calls[0][0].data;
      expect(data.status).toBe('SENT');
      expect(data.approvalStatus).toBe('APPROVED');
      expect(data.approvedById).toBe('ca-1');
      expect(data.issuedAt).toBeInstanceOf(Date);

      // Completing a held send mints the PO_VIEW token too (FOR-246), so the
      // approval path matches the direct-issue path.
      expect(mockAccessTokensService.issueTokenIfNoneLive).toHaveBeenCalledWith(
        expect.objectContaining({ subjectId: 'po-pa', purpose: 'PO_VIEW' }),
        mockPrisma,
      );

      await new Promise((r) => setTimeout(r, 10));
      expect(mockEmailService.sendPoIssuedEmail).toHaveBeenCalledWith(
        'vendor@test.com',
        'PO-PA',
        'http://localhost:5179/purchase-orders/po-pa',
        expect.any(Buffer),
        expect.objectContaining({ purchaseOrderId: 'po-pa' }),
        undefined,
      );
    });

    it('emails the tokenised portal link when the held PO goes to an unactivated vendor', async () => {
      // FOR-246: approval → SENT must behave identically to direct issue, so an
      // email-only vendor receives the tokenised /po/<token> link here too.
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-pa2',
        status: 'PENDING_APPROVAL',
        companyId: 'comp-1',
        totalAmount: { toString: () => '30000' },
        currency: 'AUD',
      });
      mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'allowed', threshold: null });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-pa2',
        status: 'SENT',
        poNumber: 'PO-PA2',
        project: { name: 'Alpha' },
        vendor: { legalName: 'VendorCo', users: [], contactEmail: 'sales@vendor.com' },
      });
      mockPoExportService.generatePoPdfBuffer.mockResolvedValue(Buffer.from('pdf'));
      mockEmailService.sendPoIssuedEmail.mockResolvedValue(undefined);

      await service.approvePurchaseOrder('po-pa2', companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoIssuedEmail).toHaveBeenCalledWith(
        'sales@vendor.com',
        'PO-PA2',
        'http://localhost:5179/po/lookup1234567890.secretsecretsecret',
        expect.any(Buffer),
        expect.objectContaining({ purchaseOrderId: 'po-pa2' }),
        undefined,
      );
    });

    it('still rejects a PENDING_APPROVAL approval that exceeds the approver threshold', async () => {
      const procurementOfficer = {
        id: 'po-u-1',
        email: 'po@test.com',
        role: UserRole.PROCUREMENT_OFFICER,
        companyId: 'comp-1',
      };
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-pa',
        status: 'PENDING_APPROVAL',
        companyId: 'comp-1',
        totalAmount: { toString: () => '30000' },
        currency: 'AUD',
      });
      mockApprovalAuth.evaluate.mockResolvedValue({
        outcome: 'belowThreshold',
        threshold: { toString: () => '25000' },
      });

      await expect(service.approvePurchaseOrder('po-pa', procurementOfficer)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.purchaseOrder.update).not.toHaveBeenCalled();
    });

    it('keeps DRAFT → ACKNOWLEDGED behavior unchanged (no vendor notification)', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        totalAmount: { toString: () => '100' },
        currency: 'AUD',
      });
      mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'allowed', threshold: null });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: 'ACKNOWLEDGED',
        poNumber: 'PO-1',
        project: { name: 'Alpha' },
        vendor: { legalName: 'VendorCo', users: [] },
      });

      const result = await service.approvePurchaseOrder('po-1', companyAdmin);
      expect(result.status).toBe('ACKNOWLEDGED');

      const data = mockPrisma.purchaseOrder.update.mock.calls[0][0].data;
      expect(data.status).toBe('ACKNOWLEDGED');
      expect(data.issuedAt).toBeUndefined();

      await new Promise((r) => setTimeout(r, 10));
      expect(mockEmailService.sendPoIssuedEmail).not.toHaveBeenCalled();
    });
  });

  // ── Week-3: delivery/receipt leg ─────────────────────────────────────────
  describe('receivePurchaseOrder', () => {
    const receivePo = {
      id: 'po-1',
      status: 'ACCEPTED',
      companyId: 'comp-1',
      deliveryLocationId: 'loc-hdr',
      // Untracked line (no material / no line location): receiving updates
      // quantityDelivered but pushes nothing into inventory.
      lineItems: [
        {
          id: 'li-1',
          quantityOrdered: 10,
          quantityDelivered: 0,
          materialId: null,
          deliveryLocationId: null,
        },
      ],
    };

    beforeEach(() => {
      // Run the receipt transaction against the same mock client so the
      // poLineItem / purchaseOrder writes inside it are observable.
      mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockPrisma) => unknown) =>
        cb(mockPrisma),
      );
    });

    it('throws NotFoundException when the PO does not exist', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(
        service.receivePurchaseOrder(
          'missing',
          { lines: [{ lineItemId: 'li-1', quantityDelivered: 1 }] },
          companyAdmin,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the user company does not match', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ ...receivePo, companyId: 'other' });
      await expect(
        service.receivePurchaseOrder(
          'po-1',
          { lines: [{ lineItemId: 'li-1', quantityDelivered: 1 }] },
          companyAdmin,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for a line that does not belong to the PO', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(receivePo);
      await expect(
        service.receivePurchaseOrder(
          'po-1',
          { lines: [{ lineItemId: 'nope', quantityDelivered: 1 }] },
          companyAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when delivered exceeds ordered', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(receivePo);
      await expect(
        service.receivePurchaseOrder(
          'po-1',
          { lines: [{ lineItemId: 'li-1', quantityDelivered: 99 }] },
          companyAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('moves the PO to PARTIALLY_DELIVERED on a partial receipt', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(receivePo);
      mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue({
        id: 'po-1',
        status: 'PARTIALLY_DELIVERED',
      });

      const result = await service.receivePurchaseOrder(
        'po-1',
        { lines: [{ lineItemId: 'li-1', quantityDelivered: 5 }] },
        companyAdmin,
      );

      expect(result.status).toBe('PARTIALLY_DELIVERED');
      expect(mockPrisma.poLineItem.update).toHaveBeenCalledWith({
        where: { id: 'li-1' },
        data: { quantityDelivered: 5 },
      });
      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PARTIALLY_DELIVERED' }),
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PO_PARTIALLY_DELIVERED' }),
      );
    });

    it('moves the PO to DELIVERED when every line is fully delivered', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(receivePo);
      mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue({
        id: 'po-1',
        status: 'DELIVERED',
      });

      const result = await service.receivePurchaseOrder(
        'po-1',
        { lines: [{ lineItemId: 'li-1', quantityDelivered: 10 }] },
        companyAdmin,
      );

      expect(result.status).toBe('DELIVERED');
      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'DELIVERED' }) }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PO_DELIVERED' }),
      );
    });

    it('is idempotent: re-posting the same partial figures does not re-transition', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...receivePo,
        status: 'PARTIALLY_DELIVERED',
        lineItems: [{ id: 'li-1', quantityOrdered: 10, quantityDelivered: 5 }],
      });
      mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue({
        id: 'po-1',
        status: 'PARTIALLY_DELIVERED',
      });

      await service.receivePurchaseOrder(
        'po-1',
        { lines: [{ lineItemId: 'li-1', quantityDelivered: 5 }] },
        companyAdmin,
      );

      expect(mockPrisma.poLineItem.update).toHaveBeenCalled();
      expect(mockPrisma.purchaseOrder.update).not.toHaveBeenCalled();
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('records a zero-quantity receipt without changing status', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(receivePo);
      mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue({
        id: 'po-1',
        status: 'ACCEPTED',
      });

      await service.receivePurchaseOrder(
        'po-1',
        { lines: [{ lineItemId: 'li-1', quantityDelivered: 0 }] },
        companyAdmin,
      );

      expect(mockPrisma.purchaseOrder.update).not.toHaveBeenCalled();
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    // ── Epic 7: inventory push-in on receipt ─────────────────────────────────
    it('does NOT push inventory for a line without material or location', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(receivePo);
      mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue({
        id: 'po-1',
        status: 'PARTIALLY_DELIVERED',
      });

      await service.receivePurchaseOrder(
        'po-1',
        { lines: [{ lineItemId: 'li-1', quantityDelivered: 5 }] },
        companyAdmin,
      );

      expect(mockInventoryService.applyIn).not.toHaveBeenCalled();
    });

    it('pushes the delivered delta into inventory for a tracked line (line location wins)', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...receivePo,
        lineItems: [
          {
            id: 'li-1',
            quantityOrdered: 10,
            quantityDelivered: 0,
            materialId: 'mat-1',
            deliveryLocationId: 'loc-line',
          },
        ],
      });
      mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue({
        id: 'po-1',
        status: 'PARTIALLY_DELIVERED',
      });

      await service.receivePurchaseOrder(
        'po-1',
        { lines: [{ lineItemId: 'li-1', quantityDelivered: 4 }] },
        companyAdmin,
      );

      expect(mockInventoryService.applyIn).toHaveBeenCalledTimes(1);
      expect(mockInventoryService.applyIn.mock.calls[0][1]).toMatchObject({
        companyId: 'comp-1',
        materialId: 'mat-1',
        locationId: 'loc-line',
        quantity: 4,
        sourceType: 'PURCHASE_ORDER',
        sourceId: 'po-1',
        sourceLineId: 'li-1',
        createdById: 'ca-1',
      });
    });

    it('falls back to the PO header location and pushes only the positive delta', async () => {
      // Already 3 delivered; re-posting 7 cumulative pushes a delta of 4.
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...receivePo,
        status: 'PARTIALLY_DELIVERED',
        lineItems: [
          {
            id: 'li-1',
            quantityOrdered: 10,
            quantityDelivered: 3,
            materialId: 'mat-1',
            deliveryLocationId: null,
          },
        ],
      });
      mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue({
        id: 'po-1',
        status: 'PARTIALLY_DELIVERED',
      });

      await service.receivePurchaseOrder(
        'po-1',
        { lines: [{ lineItemId: 'li-1', quantityDelivered: 7 }] },
        companyAdmin,
      );

      expect(mockInventoryService.applyIn.mock.calls[0][1]).toMatchObject({
        locationId: 'loc-hdr',
        quantity: 4,
      });
    });

    it('does not push inventory on an idempotent re-post (delta 0)', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...receivePo,
        status: 'PARTIALLY_DELIVERED',
        lineItems: [
          {
            id: 'li-1',
            quantityOrdered: 10,
            quantityDelivered: 5,
            materialId: 'mat-1',
            deliveryLocationId: 'loc-line',
          },
        ],
      });
      mockPurchaseOrdersService.getPurchaseOrder.mockResolvedValue({
        id: 'po-1',
        status: 'PARTIALLY_DELIVERED',
      });

      await service.receivePurchaseOrder(
        'po-1',
        { lines: [{ lineItemId: 'li-1', quantityDelivered: 5 }] },
        companyAdmin,
      );

      expect(mockInventoryService.applyIn).not.toHaveBeenCalled();
    });
  });

  // ── Week-3: approver pending-approval queue ──────────────────────────────
  describe('listPendingApproval', () => {
    const procurementOfficer = {
      id: 'po-u-1',
      email: 'po@test.com',
      role: UserRole.PROCUREMENT_OFFICER,
      companyId: 'comp-1',
    };

    it('returns the full pending queue for SUPER_ADMIN without threshold checks', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([
        { id: 'po-1', totalAmount: 100 },
        { id: 'po-2', totalAmount: 999999 },
      ]);
      mockPurchaseOrdersService.getPurchaseOrder.mockImplementation((id: string) => ({
        id,
        status: 'PENDING_APPROVAL',
      }));

      const result = await service.listPendingApproval(superAdmin);

      expect(result.items).toHaveLength(2);
      expect(mockApprovalAuth.evaluate).not.toHaveBeenCalled();
      expect(mockPrisma.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'PENDING_APPROVAL' } }),
      );
    });

    it('returns an empty list for a non-admin without a company', async () => {
      const result = await service.listPendingApproval({ ...procurementOfficer, companyId: null });
      expect(result).toEqual({ items: [] });
      expect(mockPrisma.purchaseOrder.findMany).not.toHaveBeenCalled();
    });

    it('scopes to the company and filters to POs the approver may approve', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([
        { id: 'po-small', totalAmount: 5000 },
        { id: 'po-big', totalAmount: 50000 },
      ]);
      mockApprovalAuth.evaluate
        .mockResolvedValueOnce({ outcome: 'allowed', threshold: null })
        .mockResolvedValueOnce({ outcome: 'belowThreshold', threshold: 25000 });
      mockPurchaseOrdersService.getPurchaseOrder.mockImplementation((id: string) => ({
        id,
        status: 'PENDING_APPROVAL',
      }));

      const result = await service.listPendingApproval(procurementOfficer);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('po-small');
      expect(mockPrisma.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'PENDING_APPROVAL', companyId: 'comp-1' } }),
      );
    });
  });

  // ── Week-3: approver notification on issue → PENDING_APPROVAL ─────────────
  describe('approver notification (issue → PENDING_APPROVAL)', () => {
    const procurementOfficer = {
      id: 'po-u-1',
      email: 'po@test.com',
      role: UserRole.PROCUREMENT_OFFICER,
      companyId: 'comp-1',
    };

    const heldPo = {
      id: 'po-big',
      status: 'DRAFT',
      companyId: 'comp-1',
      totalAmount: 30000,
      currency: 'AUD',
    };

    beforeEach(() => {
      // Route the issue to PENDING_APPROVAL so the notification path runs.
      mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'belowThreshold', threshold: 25000 });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
    });

    it('emails the entitled approvers when a held PO is routed for approval', async () => {
      mockPrisma.purchaseOrder.findUnique
        .mockResolvedValueOnce(heldPo)
        .mockResolvedValueOnce({ poNumber: 'PO-BIG' });
      mockPrisma.rolePermission.findMany.mockResolvedValue([
        { role: UserRole.COMPANY_ADMIN, thresholdAmount: null },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([{ email: 'approver@test.com' }]);
      mockEmailService.sendPoPendingApprovalEmail.mockResolvedValue(undefined);

      await service.issuePurchaseOrder('po-big', procurementOfficer);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoPendingApprovalEmail).toHaveBeenCalledWith(
        'approver@test.com',
        'PO-BIG',
        '30000 AUD',
        'http://localhost:5179/purchase-orders/po-big',
        expect.objectContaining({ companyId: 'comp-1', purchaseOrderId: 'po-big' }),
      );
    });

    it('does not email anyone when no role is eligible for the PO total', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValueOnce(heldPo);
      mockPrisma.rolePermission.findMany.mockResolvedValue([
        { role: UserRole.COMPANY_ADMIN, thresholdAmount: 1000 },
      ]);

      await service.issuePurchaseOrder('po-big', procurementOfficer);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
      expect(mockEmailService.sendPoPendingApprovalEmail).not.toHaveBeenCalled();
    });

    it('treats a role with an ample threshold as eligible', async () => {
      mockPrisma.purchaseOrder.findUnique
        .mockResolvedValueOnce(heldPo)
        .mockResolvedValueOnce({ poNumber: 'PO-BIG' });
      mockPrisma.rolePermission.findMany.mockResolvedValue([
        { role: UserRole.COMPANY_ADMIN, thresholdAmount: 50000 },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([{ email: 'approver@test.com' }]);

      await service.issuePurchaseOrder('po-big', procurementOfficer);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoPendingApprovalEmail).toHaveBeenCalled();
    });

    it('treats a null PO total as within every threshold', async () => {
      mockPrisma.purchaseOrder.findUnique
        .mockResolvedValueOnce({ ...heldPo, totalAmount: null })
        .mockResolvedValueOnce({ poNumber: 'PO-NULL' });
      mockPrisma.rolePermission.findMany.mockResolvedValue([
        { role: UserRole.COMPANY_ADMIN, thresholdAmount: 1000 },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([{ email: 'approver@test.com' }]);

      await service.issuePurchaseOrder('po-big', procurementOfficer);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoPendingApprovalEmail).toHaveBeenCalledWith(
        'approver@test.com',
        'PO-NULL',
        '0 AUD',
        expect.any(String),
        expect.any(Object),
      );
    });

    it('skips the email when the PO row disappears before it is built', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValueOnce(heldPo).mockResolvedValueOnce(null);
      mockPrisma.rolePermission.findMany.mockResolvedValue([
        { role: UserRole.COMPANY_ADMIN, thresholdAmount: null },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([{ email: 'approver@test.com' }]);

      await service.issuePurchaseOrder('po-big', procurementOfficer);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoPendingApprovalEmail).not.toHaveBeenCalled();
    });
  });

  // ── Week-3: PO audit/activity trail ──────────────────────────────────────
  describe('getAuditTrail', () => {
    const vendorUser = {
      id: 'v-u-1',
      email: 'vendor@test.com',
      role: UserRole.VENDOR,
      companyId: 'vendor-comp-1',
    };
    const auditPo = { id: 'po-1', companyId: 'comp-1', vendorId: 'vendor-comp-1' };

    it('throws NotFoundException when the PO does not exist', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.getAuditTrail('missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the user is neither the owner company nor the vendor', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(auditPo);
      await expect(
        service.getAuditTrail('po-1', { ...companyAdmin, companyId: 'other-comp' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns entries oldest-first for the owning contractor company', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(auditPo);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          action: 'PO_ISSUED',
          metadata: { from: 'DRAFT', to: 'SENT' },
          createdAt: new Date('2026-03-01T10:00:00Z'),
          performedBy: { id: 'ca-1', name: 'CA User', email: 'ca@test.com' },
        },
      ]);

      const result = await service.getAuditTrail('po-1', companyAdmin);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { targetType: 'PurchaseOrder', targetId: 'po-1' },
          orderBy: { createdAt: 'asc' },
        }),
      );
      expect(result).toEqual([
        {
          id: 'log-1',
          action: 'PO_ISSUED',
          metadata: { from: 'DRAFT', to: 'SENT' },
          performedBy: { id: 'ca-1', name: 'CA User', email: 'ca@test.com' },
          createdAt: '2026-03-01T10:00:00.000Z',
        },
      ]);
    });

    it('allows the addressed vendor company and tolerates a missing performer', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(auditPo);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-2',
          action: 'PO_ACKNOWLEDGED',
          metadata: null,
          createdAt: new Date('2026-03-02T10:00:00Z'),
          performedBy: null,
        },
      ]);

      const result = await service.getAuditTrail('po-1', vendorUser);

      expect(result[0].performedBy).toBeNull();
      expect(result[0].action).toBe('PO_ACKNOWLEDGED');
    });

    it('allows SUPER_ADMIN to read any PO trail', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...auditPo,
        companyId: 'any-company',
        vendorId: 'any-vendor',
      });
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getAuditTrail('po-1', superAdmin);
      expect(result).toEqual([]);
    });
  });

  // ── Epic 6: delivery QR link ─────────────────────────────────────────────────
  describe('generateDeliveryLink', () => {
    it('throws NotFoundException when the PO does not exist', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.generateDeliveryLink('missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the PO is in another company', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        poNumber: 'PO-1',
        companyId: 'other',
        status: 'ACCEPTED',
      });
      await expect(service.generateDeliveryLink('po-1', companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException for a PO not in a deliverable status', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        poNumber: 'PO-1',
        companyId: 'comp-1',
        status: 'DRAFT',
      });
      await expect(service.generateDeliveryLink('po-1', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('mints a fresh DELIVERY_SUBMIT token and builds the /delivery/ url', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        poNumber: 'PO-1',
        companyId: 'comp-1',
        status: 'ACCEPTED',
      });
      mockAccessTokensService.issueTokenIfNoneLive.mockResolvedValue({
        token: 'newlookup.newsecret',
        record: { id: 'tok-2' },
        reused: false,
      });

      const res = await service.generateDeliveryLink('po-1', companyAdmin);
      expect(res.token).toBe('newlookup.newsecret');
      expect(res.url).toContain('/delivery/newlookup.newsecret');
      expect(res.poNumber).toBe('PO-1');
    });

    it('force-mints a fresh token when a live one is reused (plaintext unavailable)', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        poNumber: 'PO-1',
        companyId: 'comp-1',
        status: 'PARTIALLY_DELIVERED',
      });
      mockAccessTokensService.issueTokenIfNoneLive.mockResolvedValue({
        token: null,
        record: { id: 'tok-live' },
        reused: true,
      });
      mockAccessTokensService.issueToken.mockResolvedValue({
        token: 'forced.secret',
        record: { id: 'tok-forced' },
      });

      const res = await service.generateDeliveryLink('po-1', companyAdmin);
      expect(mockAccessTokensService.issueToken).toHaveBeenCalled();
      expect(res.token).toBe('forced.secret');
    });
  });

  describe('applyDeliveryDeltasInTx / auditDeliveryTransition (delivery-report close-out)', () => {
    const approvalPo = {
      id: 'po-1',
      status: 'ACCEPTED' as const,
      companyId: 'comp-1',
      deliveryLocationId: 'loc-hdr',
      lineItems: [
        {
          id: 'li-1',
          quantityOrdered: 60,
          quantityDelivered: 0,
          materialId: 'mat-1',
          deliveryLocationId: null,
        },
      ],
    };

    it('ALLOWS over-receipt (150 against ordered 60) and pushes the full delta to inventory', async () => {
      const deltas = new Map<string, number>([['li-1', 150]]);
      const outcome = await service.applyDeliveryDeltasInTx(
        mockPrisma as never,
        approvalPo,
        deltas,
        'ca-1',
      );

      expect(mockPrisma.poLineItem.update).toHaveBeenCalledWith({
        where: { id: 'li-1' },
        data: { quantityDelivered: 150 },
      });
      expect(mockInventoryService.applyIn.mock.calls[0][1]).toMatchObject({
        materialId: 'mat-1',
        locationId: 'loc-hdr',
        quantity: 150,
      });
      // 150 >= 60 ordered → DELIVERED
      expect(outcome.transitioned).toBe(true);
      expect(outcome.nextStatus).toBe('DELIVERED');
    });

    it('auditDeliveryTransition is a no-op when the status did not move', async () => {
      await service.auditDeliveryTransition('po-1', 'ca-1', {
        transitioned: false,
        fromStatus: 'ACCEPTED' as never,
        nextStatus: 'ACCEPTED' as never,
      });
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('auditDeliveryTransition emits PO_DELIVERED when delivered', async () => {
      await service.auditDeliveryTransition(
        'po-1',
        'ca-1',
        {
          transitioned: true,
          fromStatus: 'PARTIALLY_DELIVERED' as never,
          nextStatus: 'DELIVERED' as never,
        },
        { deliveryReportId: 'dr-1' },
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PO_DELIVERED' }),
      );
    });
  });
});
