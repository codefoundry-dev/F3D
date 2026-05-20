import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  BulkOrderChangeRequestStatus,
  BulkOrderStatus,
  UserRole,
} from '@prisma/client';

import { BulkOrderChangeService } from '../bulk-order-change.service';

const mockPrisma = {
  bulkOrder: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  bulkOrderChangeRequest: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  bulkOrderLineItem: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAuditService = {
  log: jest.fn(),
};

const mockEmailService = {
  sendTemplateEmail: jest.fn(),
  sendChangeRequestProposedEmail: jest.fn(),
  sendChangeRequestApprovedEmail: jest.fn(),
  sendChangeRequestRejectedEmail: jest.fn(),
  sendBulkOrderCancelledEmail: jest.fn(),
};

const mockConfig = {
  get: jest.fn((_key: string, fallback: string) => fallback),
};

const contractorUser = {
  id: 'cu-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};

const vendorUser = {
  id: 'vu-1',
  email: 'vendor@test.com',
  role: UserRole.VENDOR,
  companyId: 'vendor-comp-1',
};

const superAdmin = {
  id: 'sa-1',
  email: 'sa@test.com',
  role: UserRole.SUPER_ADMIN,
  companyId: null,
};

const activeBulkOrder = {
  id: 'bo-1',
  status: BulkOrderStatus.ACTIVE,
  companyId: 'comp-1',
  vendorId: 'vendor-comp-1',
  version: 1,
};

describe('BulkOrderChangeService', () => {
  let service: BulkOrderChangeService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ name: 'Test User' });
    service = new BulkOrderChangeService(
      mockPrisma as never,
      mockAuditService as never,
      mockEmailService as never,
      mockConfig as never,
    );
  });

  // ── proposeChange ────────────────────────────────────────────────────────

  describe('proposeChange', () => {
    it('should create change request', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);
      const createdCr = {
        id: 'cr-1',
        bulkOrderId: 'bo-1',
        status: BulkOrderChangeRequestStatus.PENDING,
        requestedBy: { id: 'cu-1', name: 'Test User' },
      };
      mockPrisma.bulkOrderChangeRequest.create.mockResolvedValue(createdCr);
      mockAuditService.log.mockResolvedValue(undefined);

      const dto = { endDate: '2027-01-01', message: 'Extend deadline' };
      const result = await service.proposeChange('bo-1', dto as never, contractorUser);

      expect(result).toEqual(createdCr);
      expect(mockPrisma.bulkOrderChangeRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bulkOrderId: 'bo-1',
            requestedByUserId: 'cu-1',
            status: BulkOrderChangeRequestStatus.PENDING,
            message: 'Extend deadline',
          }),
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.BULK_ORDER_CHANGE_PROPOSED,
          performedById: 'cu-1',
          targetId: 'bo-1',
        }),
      );
    });

    it('should throw if bulk order not ACTIVE', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({
        ...activeBulkOrder,
        status: BulkOrderStatus.COMPLETED,
      });

      await expect(service.proposeChange('bo-1', {} as never, contractorUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if user has no access', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);

      const otherUser = {
        id: 'other-1',
        email: 'other@test.com',
        role: UserRole.COMPANY_ADMIN,
        companyId: 'other-comp',
      };

      await expect(service.proposeChange('bo-1', {} as never, otherUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow vendor user with matching vendorId to propose', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);
      mockPrisma.bulkOrderChangeRequest.create.mockResolvedValue({
        id: 'cr-2',
        requestedBy: { id: 'vu-1', name: 'Vendor User' },
      });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.proposeChange('bo-1', { message: 'test' } as never, vendorUser);
      expect(result.id).toBe('cr-2');
    });

    it('should throw NotFoundException when bulk order does not exist', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(null);

      await expect(service.proposeChange('missing', {} as never, contractorUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── listChangeRequests ───────────────────────────────────────────────────

  describe('listChangeRequests', () => {
    it('should return change requests for bulk order', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);
      const changeRequests = [
        { id: 'cr-1', status: BulkOrderChangeRequestStatus.PENDING },
        { id: 'cr-2', status: BulkOrderChangeRequestStatus.APPROVED },
      ];
      mockPrisma.bulkOrderChangeRequest.findMany.mockResolvedValue(changeRequests);

      const result = await service.listChangeRequests('bo-1', contractorUser);

      expect(result).toEqual(changeRequests);
      expect(mockPrisma.bulkOrderChangeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bulkOrderId: 'bo-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should throw NotFoundException when bulk order does not exist', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(null);

      await expect(service.listChangeRequests('missing', contractorUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user has no access', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);

      const otherUser = {
        id: 'other-1',
        email: 'other@test.com',
        role: UserRole.VENDOR,
        companyId: 'other-vendor',
      };

      await expect(service.listChangeRequests('bo-1', otherUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── approveChange ────────────────────────────────────────────────────────

  describe('approveChange', () => {
    const pendingCr = {
      id: 'cr-1',
      bulkOrderId: 'bo-1',
      status: BulkOrderChangeRequestStatus.PENDING,
      requestedByUserId: 'vu-1',
      changes: {
        endDate: '2027-06-01',
        lineItems: [],
      },
    };

    it('should apply changes and bump version', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({
        ...activeBulkOrder,
        lineItems: [],
      });
      mockPrisma.bulkOrderChangeRequest.findUnique.mockResolvedValue(pendingCr);

      // Mock $transaction to execute the callback
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          bulkOrder: { update: jest.fn().mockResolvedValue({}) },
          bulkOrderChangeRequest: { update: jest.fn().mockResolvedValue({}) },
          bulkOrderLineItem: {
            findMany: jest.fn().mockResolvedValue([{ totalLineInc: 5000 }]),
            create: jest.fn().mockResolvedValue({}),
            update: jest.fn().mockResolvedValue({}),
            delete: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.approveChange('bo-1', 'cr-1', contractorUser);

      expect(result).toEqual({ approved: true });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.BULK_ORDER_CHANGE_APPROVED,
          performedById: 'cu-1',
          targetId: 'bo-1',
          metadata: { changeRequestId: 'cr-1' },
        }),
      );
    });

    it('should throw if change request not PENDING', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({
        ...activeBulkOrder,
        lineItems: [],
      });
      mockPrisma.bulkOrderChangeRequest.findUnique.mockResolvedValue({
        ...pendingCr,
        status: BulkOrderChangeRequestStatus.APPROVED,
      });

      await expect(service.approveChange('bo-1', 'cr-1', contractorUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if approver is the same as requester', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({
        ...activeBulkOrder,
        lineItems: [],
      });
      mockPrisma.bulkOrderChangeRequest.findUnique.mockResolvedValue({
        ...pendingCr,
        requestedByUserId: 'cu-1',
      });

      await expect(service.approveChange('bo-1', 'cr-1', contractorUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when bulk order does not exist', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(null);

      await expect(service.approveChange('missing', 'cr-1', contractorUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when change request does not exist', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({
        ...activeBulkOrder,
        lineItems: [],
      });
      mockPrisma.bulkOrderChangeRequest.findUnique.mockResolvedValue(null);

      await expect(service.approveChange('bo-1', 'missing', contractorUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    // ── Line item change actions (lines 130-168) ──────────────────────────

    const existingLineItem = {
      id: 'li-1',
      bulkOrderId: 'bo-1',
      itemReference: 'ITEM-001',
      description: 'Steel beams',
      qty: 100,
      unit: 'EA',
      ordered: 10,
      qtyRemaining: 90,
      pricePerUnit: 50,
      totalLineInc: 5000,
    };

    function buildTxMocks() {
      const tx = {
        bulkOrder: { update: jest.fn().mockResolvedValue({}) },
        bulkOrderChangeRequest: { update: jest.fn().mockResolvedValue({}) },
        bulkOrderLineItem: {
          findMany: jest.fn().mockResolvedValue([{ totalLineInc: 6000 }]),
          create: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
          delete: jest.fn().mockResolvedValue({}),
        },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(tx),
      );
      return tx;
    }

    function setupApproveWithLineItems(
      lineItems: Array<Record<string, unknown>>,
      boLineItems = [existingLineItem],
    ) {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({
        ...activeBulkOrder,
        lineItems: boLineItems,
      });
      mockPrisma.bulkOrderChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        bulkOrderId: 'bo-1',
        status: BulkOrderChangeRequestStatus.PENDING,
        requestedByUserId: 'vu-1',
        changes: { lineItems },
      });
      mockAuditService.log.mockResolvedValue(undefined);
    }

    it('should apply update line item action with quantity and unitPrice', async () => {
      setupApproveWithLineItems([
        { lineItemId: 'li-1', action: 'update', quantity: 150, unitPrice: 60 },
      ]);
      const tx = buildTxMocks();

      const result = await service.approveChange('bo-1', 'cr-1', contractorUser);

      expect(result).toEqual({ approved: true });
      expect(tx.bulkOrderLineItem.update).toHaveBeenCalledWith({
        where: { id: 'li-1' },
        data: {
          qty: 150,
          qtyRemaining: 90 + (150 - 100), // existing.qtyRemaining + qtyDiff
          pricePerUnit: 60,
          totalLineInc: 150 * 60,
        },
      });
    });

    it('should skip update when lineItemId not found in existing line items', async () => {
      setupApproveWithLineItems([
        { lineItemId: 'li-nonexistent', action: 'update', quantity: 200 },
      ]);
      const tx = buildTxMocks();

      const result = await service.approveChange('bo-1', 'cr-1', contractorUser);

      expect(result).toEqual({ approved: true });
      expect(tx.bulkOrderLineItem.update).not.toHaveBeenCalled();
    });

    it('should apply add line item action', async () => {
      setupApproveWithLineItems([
        {
          action: 'add',
          itemReference: 'ITEM-002',
          description: 'Concrete mix',
          quantity: 50,
          unitPrice: 30,
          uom: 'BAG',
        },
      ]);
      const tx = buildTxMocks();

      const result = await service.approveChange('bo-1', 'cr-1', contractorUser);

      expect(result).toEqual({ approved: true });
      expect(tx.bulkOrderLineItem.create).toHaveBeenCalledWith({
        data: {
          bulkOrderId: 'bo-1',
          itemReference: 'ITEM-002',
          description: 'Concrete mix',
          qty: 50,
          unit: 'BAG',
          ordered: 0,
          qtyRemaining: 50,
          pricePerUnit: 30,
          totalLineInc: 50 * 30,
        },
      });
    });

    it('should apply remove line item action', async () => {
      setupApproveWithLineItems([{ lineItemId: 'li-1', action: 'remove' }]);
      const tx = buildTxMocks();

      const result = await service.approveChange('bo-1', 'cr-1', contractorUser);

      expect(result).toEqual({ approved: true });
      expect(tx.bulkOrderLineItem.delete).toHaveBeenCalledWith({ where: { id: 'li-1' } });
    });

    it('should use existing values when update provides only unitPrice (no quantity)', async () => {
      setupApproveWithLineItems([{ lineItemId: 'li-1', action: 'update', unitPrice: 75 }]);
      const tx = buildTxMocks();

      await service.approveChange('bo-1', 'cr-1', contractorUser);

      // quantity is undefined so qty/qtyRemaining should NOT be spread,
      // but totalLineInc uses existing qty * new price
      expect(tx.bulkOrderLineItem.update).toHaveBeenCalledWith({
        where: { id: 'li-1' },
        data: {
          pricePerUnit: 75,
          totalLineInc: 100 * 75, // existing.qty * new unitPrice
        },
      });
    });

    it('should update uom when provided in update action', async () => {
      setupApproveWithLineItems([{ lineItemId: 'li-1', action: 'update', uom: 'KG' }]);
      const tx = buildTxMocks();

      await service.approveChange('bo-1', 'cr-1', contractorUser);

      // Only uom is provided: no quantity spread, no unitPrice spread,
      // totalLineInc uses existing qty * existing price
      expect(tx.bulkOrderLineItem.update).toHaveBeenCalledWith({
        where: { id: 'li-1' },
        data: {
          unit: 'KG',
          totalLineInc: 100 * 50, // existing.qty * existing.pricePerUnit
        },
      });
    });

    it('should use fallback defaults for add action when optional fields are omitted', async () => {
      setupApproveWithLineItems([{ action: 'add' }]);
      const tx = buildTxMocks();

      await service.approveChange('bo-1', 'cr-1', contractorUser);

      expect(tx.bulkOrderLineItem.create).toHaveBeenCalledWith({
        data: {
          bulkOrderId: 'bo-1',
          itemReference: '',
          description: '',
          qty: 0,
          unit: 'EA',
          ordered: 0,
          qtyRemaining: 0,
          pricePerUnit: 0,
          totalLineInc: 0,
        },
      });
    });
  });

  // ── rejectChange ─────────────────────────────────────────────────────────

  describe('rejectChange', () => {
    const pendingCr = {
      id: 'cr-1',
      bulkOrderId: 'bo-1',
      status: BulkOrderChangeRequestStatus.PENDING,
      requestedByUserId: 'vu-1',
    };

    it('should reject with reason', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);
      mockPrisma.bulkOrderChangeRequest.findUnique.mockResolvedValue(pendingCr);
      mockPrisma.bulkOrderChangeRequest.update.mockResolvedValue({});
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.rejectChange(
        'bo-1',
        'cr-1',
        { reason: 'Not justified' },
        contractorUser,
      );

      expect(result).toEqual({ rejected: true });
      expect(mockPrisma.bulkOrderChangeRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cr-1' },
          data: expect.objectContaining({
            status: BulkOrderChangeRequestStatus.REJECTED,
            reason: 'Not justified',
            resolvedByUserId: 'cu-1',
          }),
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.BULK_ORDER_CHANGE_REJECTED,
          performedById: 'cu-1',
          metadata: { changeRequestId: 'cr-1' },
        }),
      );
    });

    it('should throw if change request not PENDING', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);
      mockPrisma.bulkOrderChangeRequest.findUnique.mockResolvedValue({
        ...pendingCr,
        status: BulkOrderChangeRequestStatus.REJECTED,
      });

      await expect(
        service.rejectChange('bo-1', 'cr-1', { reason: 'No' }, contractorUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if rejector is the same as requester', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);
      mockPrisma.bulkOrderChangeRequest.findUnique.mockResolvedValue({
        ...pendingCr,
        requestedByUserId: 'cu-1',
      });

      await expect(
        service.rejectChange('bo-1', 'cr-1', { reason: 'No' }, contractorUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── cancelBulkOrder ──────────────────────────────────────────────────────

  describe('cancelBulkOrder', () => {
    it('should set status to CANCELLED', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);
      mockPrisma.bulkOrder.update.mockResolvedValue({});
      mockPrisma.bulkOrderChangeRequest.updateMany.mockResolvedValue({ count: 0 });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.cancelBulkOrder('bo-1', contractorUser);

      expect(result).toEqual({ cancelled: true });
      expect(mockPrisma.bulkOrder.update).toHaveBeenCalledWith({
        where: { id: 'bo-1' },
        data: { status: BulkOrderStatus.CANCELLED },
      });
    });

    it('should reject all pending change requests', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);
      mockPrisma.bulkOrder.update.mockResolvedValue({});
      mockPrisma.bulkOrderChangeRequest.updateMany.mockResolvedValue({ count: 3 });
      mockAuditService.log.mockResolvedValue(undefined);

      await service.cancelBulkOrder('bo-1', contractorUser);

      expect(mockPrisma.bulkOrderChangeRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            bulkOrderId: 'bo-1',
            status: BulkOrderChangeRequestStatus.PENDING,
          },
          data: expect.objectContaining({
            status: BulkOrderChangeRequestStatus.REJECTED,
            reason: 'Bulk order cancelled',
            resolvedByUserId: 'cu-1',
          }),
        }),
      );
    });

    it('should throw if already cancelled', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({
        ...activeBulkOrder,
        status: BulkOrderStatus.CANCELLED,
      });

      await expect(service.cancelBulkOrder('bo-1', contractorUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when bulk order does not exist', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(null);

      await expect(service.cancelBulkOrder('missing', contractorUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should log audit on cancellation', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);
      mockPrisma.bulkOrder.update.mockResolvedValue({});
      mockPrisma.bulkOrderChangeRequest.updateMany.mockResolvedValue({ count: 0 });
      mockAuditService.log.mockResolvedValue(undefined);

      await service.cancelBulkOrder('bo-1', contractorUser);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.BULK_ORDER_CANCELLED,
          performedById: 'cu-1',
          targetType: 'BulkOrder',
          targetId: 'bo-1',
        }),
      );
    });

    it('should allow SUPER_ADMIN to cancel', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);
      mockPrisma.bulkOrder.update.mockResolvedValue({});
      mockPrisma.bulkOrderChangeRequest.updateMany.mockResolvedValue({ count: 0 });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.cancelBulkOrder('bo-1', superAdmin);
      expect(result).toEqual({ cancelled: true });
    });

    it('should throw ForbiddenException when user has no access', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);

      const otherUser = {
        id: 'other-1',
        email: 'other@test.com',
        role: UserRole.COMPANY_ADMIN,
        companyId: 'other-comp',
      };

      await expect(service.cancelBulkOrder('bo-1', otherUser)).rejects.toThrow(ForbiddenException);
    });

    it('should use user email as fallback when user name is null', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);
      mockPrisma.bulkOrder.update.mockResolvedValue({});
      mockPrisma.bulkOrderChangeRequest.updateMany.mockResolvedValue({ count: 0 });
      mockAuditService.log.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.cancelBulkOrder('bo-1', contractorUser);

      expect(result).toEqual({ cancelled: true });
    });
  });

  // ── Notification email branches ─────────────────────────────────────────

  describe('notification emails (private methods via public API)', () => {
    it('proposeChange notifies counterparty vendor users when contractor proposes', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);
      mockPrisma.bulkOrderChangeRequest.create.mockResolvedValue({
        id: 'cr-1',
        requestedBy: { id: 'cu-1', name: 'Contractor User' },
      });
      mockAuditService.log.mockResolvedValue(undefined);
      mockPrisma.user.findMany.mockResolvedValue([{ email: 'v1@test.com', role: UserRole.VENDOR }]);
      mockEmailService.sendChangeRequestProposedEmail.mockResolvedValue(undefined);

      await service.proposeChange('bo-1', { message: 'change' } as never, contractorUser);

      // Wait for fire-and-forget promise
      await new Promise((r) => setTimeout(r, 50));

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'vendor-comp-1',
            role: { in: [UserRole.VENDOR] },
            status: 'ACTIVE',
          }),
        }),
      );
      expect(mockEmailService.sendChangeRequestProposedEmail).toHaveBeenCalledWith(
        'v1@test.com',
        expect.stringContaining('BO-'),
        'Contractor User',
        expect.stringContaining('/bulk-orders/bo-1/review-change'),
      );
    });

    it('proposeChange notifies counterparty company users when vendor proposes', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);
      mockPrisma.bulkOrderChangeRequest.create.mockResolvedValue({
        id: 'cr-2',
        requestedBy: { id: 'vu-1', name: 'Vendor User' },
      });
      mockAuditService.log.mockResolvedValue(undefined);
      mockPrisma.user.findMany.mockResolvedValue([
        { email: 'ca@test.com', role: UserRole.COMPANY_ADMIN },
        { email: 'po@test.com', role: UserRole.PROCUREMENT_OFFICER },
      ]);
      mockEmailService.sendChangeRequestProposedEmail.mockResolvedValue(undefined);

      await service.proposeChange('bo-1', { message: 'change' } as never, vendorUser);

      await new Promise((r) => setTimeout(r, 50));

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'comp-1',
            role: { in: [UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER] },
          }),
        }),
      );
      // The counterparty is NOT vendor, so getBulkOrderUrl uses COMPANY_ADMIN base
      expect(mockEmailService.sendChangeRequestProposedEmail).toHaveBeenCalledTimes(2);
    });

    it('approveChange sends approved email to all parties including PROCUREMENT_OFFICER url', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({
        ...activeBulkOrder,
        lineItems: [],
      });
      mockPrisma.bulkOrderChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        bulkOrderId: 'bo-1',
        status: BulkOrderChangeRequestStatus.PENDING,
        requestedByUserId: 'vu-1',
        changes: {},
      });
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          bulkOrder: { update: jest.fn().mockResolvedValue({}) },
          bulkOrderChangeRequest: { update: jest.fn().mockResolvedValue({}) },
          bulkOrderLineItem: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        };
        return fn(tx);
      });
      mockAuditService.log.mockResolvedValue(undefined);
      mockPrisma.user.findMany.mockResolvedValue([
        { email: 'ca@test.com', role: UserRole.COMPANY_ADMIN },
        { email: 'po@test.com', role: UserRole.PROCUREMENT_OFFICER },
        { email: 'v@test.com', role: UserRole.VENDOR },
      ]);
      mockEmailService.sendChangeRequestApprovedEmail.mockResolvedValue(undefined);

      await service.approveChange('bo-1', 'cr-1', contractorUser);

      await new Promise((r) => setTimeout(r, 50));

      expect(mockEmailService.sendChangeRequestApprovedEmail).toHaveBeenCalledTimes(3);
      // All roles share the unified WEB_APP_URL
      expect(mockEmailService.sendChangeRequestApprovedEmail).toHaveBeenCalledWith(
        'ca@test.com',
        expect.stringContaining('BO-'),
        expect.stringContaining('/bulk-orders/bo-1'),
      );
      expect(mockEmailService.sendChangeRequestApprovedEmail).toHaveBeenCalledWith(
        'po@test.com',
        expect.stringContaining('BO-'),
        expect.stringContaining('/bulk-orders/bo-1'),
      );
      expect(mockEmailService.sendChangeRequestApprovedEmail).toHaveBeenCalledWith(
        'v@test.com',
        expect.stringContaining('BO-'),
        expect.stringContaining('/bulk-orders/bo-1'),
      );
    });

    it('rejectChange sends rejected email to all parties', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);
      mockPrisma.bulkOrderChangeRequest.findUnique.mockResolvedValue({
        id: 'cr-1',
        bulkOrderId: 'bo-1',
        status: BulkOrderChangeRequestStatus.PENDING,
        requestedByUserId: 'vu-1',
      });
      mockPrisma.bulkOrderChangeRequest.update.mockResolvedValue({});
      mockAuditService.log.mockResolvedValue(undefined);
      mockPrisma.user.findMany.mockResolvedValue([
        { email: 'ca@test.com', role: UserRole.COMPANY_ADMIN },
        { email: 'v@test.com', role: UserRole.VENDOR },
      ]);
      mockEmailService.sendChangeRequestRejectedEmail.mockResolvedValue(undefined);

      await service.rejectChange('bo-1', 'cr-1', { reason: 'No' }, contractorUser);

      await new Promise((r) => setTimeout(r, 50));

      expect(mockEmailService.sendChangeRequestRejectedEmail).toHaveBeenCalledTimes(2);
      expect(mockEmailService.sendChangeRequestRejectedEmail).toHaveBeenCalledWith(
        'v@test.com',
        expect.stringContaining('BO-'),
        expect.stringContaining('http://localhost:5179/bulk-orders/bo-1'),
      );
    });

    it('cancelBulkOrder sends cancelled email to all parties', async () => {
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(activeBulkOrder);
      mockPrisma.bulkOrder.update.mockResolvedValue({});
      mockPrisma.bulkOrderChangeRequest.updateMany.mockResolvedValue({ count: 0 });
      mockAuditService.log.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Canceller Name' });
      mockPrisma.user.findMany.mockResolvedValue([
        { email: 'ca@test.com', role: UserRole.COMPANY_ADMIN },
        { email: 'v@test.com', role: UserRole.VENDOR },
      ]);
      mockEmailService.sendBulkOrderCancelledEmail.mockResolvedValue(undefined);

      await service.cancelBulkOrder('bo-1', contractorUser);

      await new Promise((r) => setTimeout(r, 50));

      expect(mockEmailService.sendBulkOrderCancelledEmail).toHaveBeenCalledTimes(2);
      expect(mockEmailService.sendBulkOrderCancelledEmail).toHaveBeenCalledWith(
        'ca@test.com',
        expect.stringContaining('BO-'),
        'Canceller Name',
      );
      expect(mockEmailService.sendBulkOrderCancelledEmail).toHaveBeenCalledWith(
        'v@test.com',
        expect.stringContaining('BO-'),
        'Canceller Name',
      );
    });
  });
});
