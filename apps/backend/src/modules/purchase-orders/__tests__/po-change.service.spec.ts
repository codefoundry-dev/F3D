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

const mockTx = {
  purchaseOrder: { update: jest.fn() },
  poLineItem: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  poChangeRequest: { update: jest.fn() },
};

const mockPrisma = {
  purchaseOrder: { findUnique: jest.fn() },
  poChangeRequest: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  poLineItem: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  user: { findUnique: jest.fn() },
  $transaction: jest.fn(),
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
    mockPrisma.poChangeRequest.count.mockResolvedValue(0);
    // The apply transaction invokes its callback with the tx client. (jest's
    // clearAllMocks above has already reset mockTx's call history.)
    mockTx.purchaseOrder.update.mockResolvedValue({});
    mockTx.poChangeRequest.update.mockResolvedValue({});
    mockTx.poLineItem.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockTx) => unknown) => cb(mockTx));
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
      vendor: { contactEmail: 'contact@vendor.com', users: [{ email: 'vendor@vendor.com' }] },
    };

    const dto = {
      changeType: 'COMMERCIAL',
      changedFields: { fields: { paymentTermsDays: { from: 30, to: 60 } } },
      message: 'Please update terms',
    };

    function createdCr(overrides: Record<string, unknown> = {}) {
      return {
        id: 'cr-1',
        purchaseOrderId: 'po-1',
        reference: 'CR-001',
        changeType: 'COMMERCIAL',
        changedFields: dto.changedFields,
        message: 'Please update terms',
        status: 'PENDING',
        reason: null,
        resolvedAt: null,
        createdAt: new Date('2026-06-13T00:00:00.000Z'),
        requestedBy: { id: 'v-u-1', name: 'Vendor User', company: { legalName: 'VendorCo' } },
        resolvedBy: null,
        ...overrides,
      };
    }

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

    it('creates a change request with a sequential reference and returns the shaped response', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poChangeRequest.count.mockResolvedValue(3); // → CR-004
      mockPrisma.poChangeRequest.create.mockResolvedValue(createdCr({ reference: 'CR-004' }));

      const result = await service.proposeChange('po-1', dto as never, vendorUser);

      expect(result.id).toBe('cr-1');
      expect(result.reference).toBe('CR-004');
      expect(result.requestedByName).toBe('Vendor User');
      expect(result.requestedByCompanyName).toBe('VendorCo');
      expect(result.changedFields).toEqual(dto.changedFields);
      expect(result.message).toBe('Please update terms');
      expect(mockPrisma.poChangeRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            purchaseOrderId: 'po-1',
            reference: 'CR-004',
            changeType: 'COMMERCIAL',
            message: 'Please update terms',
            status: 'PENDING',
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
      mockPrisma.poChangeRequest.create.mockResolvedValue(createdCr());

      await service.proposeChange('po-1', dto as never, vendorUser);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendChangeRequestProposedEmail).toHaveBeenCalledWith(
        'admin@contractor.com',
        'PO-0001',
        'Vendor User',
        'http://localhost:5179/purchase-orders/po-1',
      );
    });

    it('sends email to vendor when contractor proposes a change', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poChangeRequest.create.mockResolvedValue(
        createdCr({ requestedBy: { id: 'ca-1', name: 'CA Admin', company: { legalName: 'Con' } } }),
      );

      await service.proposeChange('po-1', dto as never, companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendChangeRequestProposedEmail).toHaveBeenCalledWith(
        'vendor@vendor.com',
        'PO-0001',
        'CA Admin',
        'http://localhost:5179/purchase-orders/po-1',
      );
    });

    it('falls back to the vendor contactEmail when the vendor has no user accounts', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...poWithRelations,
        vendor: { contactEmail: 'quickadd@vendor.com', users: [] },
      });
      mockPrisma.poChangeRequest.create.mockResolvedValue(
        createdCr({ requestedBy: { id: 'ca-1', name: 'CA Admin', company: { legalName: 'Con' } } }),
      );

      await service.proposeChange('po-1', dto as never, companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendChangeRequestProposedEmail).toHaveBeenCalledWith(
        'quickadd@vendor.com',
        'PO-0001',
        'CA Admin',
        'http://localhost:5179/purchase-orders/po-1',
      );
    });

    it('uses only the vendor contactEmail when the vendor object has no users array', async () => {
      // vendor.users undefined → `po.vendor?.users ?? []` fallback.
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...poWithRelations,
        vendor: { contactEmail: 'only@vendor.com' },
      });
      mockPrisma.poChangeRequest.create.mockResolvedValue(
        createdCr({ requestedBy: { id: 'ca-1', name: 'CA Admin', company: { legalName: 'Con' } } }),
      );

      await service.proposeChange('po-1', dto as never, companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendChangeRequestProposedEmail).toHaveBeenCalledWith(
        'only@vendor.com',
        'PO-0001',
        'CA Admin',
        expect.any(String),
      );
    });

    it('does not fail when email sending throws', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poChangeRequest.create.mockResolvedValue(createdCr());
      mockEmailService.sendChangeRequestProposedEmail.mockRejectedValue(new Error('SMTP down'));

      const result = await service.proposeChange('po-1', dto as never, vendorUser);
      expect(result.id).toBe('cr-1');
    });

    it('lets a SUPER_ADMIN propose a change regardless of company (validateAccess bypass)', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poChangeRequest.create.mockResolvedValue(createdCr());
      const superAdmin = {
        id: 's-1',
        email: 's@test.com',
        role: UserRole.SUPER_ADMIN,
        companyId: 'unrelated',
      };

      const result = await service.proposeChange('po-1', dto as never, superAdmin as never);
      expect(result.id).toBe('cr-1');
    });

    it('sends no email when the vendor proposes but the contractor company has no users', async () => {
      // Vendor proposes; contractor company object is absent → `?? []` → empty
      // recipient list → no proposed-change email is attempted.
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ ...poWithRelations, company: null });
      mockPrisma.poChangeRequest.create.mockResolvedValue(createdCr());

      const result = await service.proposeChange('po-1', dto as never, vendorUser);
      await new Promise((r) => setTimeout(r, 10));

      expect(result.id).toBe('cr-1');
      expect(mockEmailService.sendChangeRequestProposedEmail).not.toHaveBeenCalled();
    });

    it('labels an unnamed requester "A user" and defaults changedFields/message when omitted', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poChangeRequest.create.mockResolvedValue(
        createdCr({ requestedBy: null, message: null }),
      );

      // Neither changedFields nor message supplied → service defaults them.
      const bareDto = { changeType: 'INTERNAL' };
      await service.proposeChange('po-1', bareDto as never, vendorUser);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockPrisma.poChangeRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ changedFields: {}, message: null }),
        }),
      );
      expect(mockEmailService.sendChangeRequestProposedEmail).toHaveBeenCalledWith(
        'admin@contractor.com',
        'PO-0001',
        'A user',
        'http://localhost:5179/purchase-orders/po-1',
      );
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

    it('returns the shaped change requests for the PO', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        companyId: 'comp-1',
        vendorId: 'vendor-comp-1',
      });
      mockPrisma.poChangeRequest.findMany.mockResolvedValue([
        {
          id: 'cr-1',
          purchaseOrderId: 'po-1',
          reference: 'CR-001',
          changeType: 'COMMERCIAL',
          changedFields: { fields: {} },
          message: 'm',
          status: 'APPROVED',
          reason: null,
          resolvedAt: new Date('2026-06-13T10:00:00.000Z'),
          createdAt: new Date('2026-06-13T00:00:00.000Z'),
          requestedBy: { id: 'v-u-1', name: 'Vendor User', company: { legalName: 'VendorCo' } },
          resolvedBy: { id: 'ca-1', name: 'CA Admin' },
        },
      ]);

      const result = await service.listChangeRequests('po-1', vendorUser);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'cr-1',
          reference: 'CR-001',
          status: 'APPROVED',
          requestedByName: 'Vendor User',
          requestedByCompanyName: 'VendorCo',
          resolvedByName: 'CA Admin',
          resolvedAt: '2026-06-13T10:00:00.000Z',
        }),
      );
    });

    it('null-coalesces requester/company/resolver when those relations are absent', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        companyId: 'comp-1',
        vendorId: 'vendor-comp-1',
      });
      mockPrisma.poChangeRequest.findMany.mockResolvedValue([
        {
          id: 'cr-2',
          purchaseOrderId: 'po-1',
          reference: null,
          changeType: 'INTERNAL',
          changedFields: {},
          message: null,
          status: 'PENDING',
          reason: null,
          resolvedAt: null,
          createdAt: new Date('2026-06-13T00:00:00.000Z'),
          requestedBy: { id: 'u-x', name: 'Someone', company: null },
          resolvedBy: null,
        },
      ]);

      const result = await service.listChangeRequests('po-1', vendorUser);
      expect(result[0]).toEqual(
        expect.objectContaining({
          requestedByName: 'Someone',
          requestedByCompanyName: null,
          resolvedByName: null,
          resolvedAt: null,
        }),
      );
    });
  });

  // ── approveChange ─────────────────────────────────────────────────────────

  describe('approveChange', () => {
    function pendingCr(overrides: Record<string, unknown> = {}) {
      return {
        id: 'cr-1',
        reference: 'CR-002',
        requestedById: 'v-u-1',
        status: 'PENDING',
        changeType: 'COMMERCIAL',
        changedFields: { fields: { paymentTermsDays: { from: 30, to: 10 } } },
        requestedBy: { id: 'v-u-1', name: 'Vendor User' },
        ...overrides,
      };
    }

    it('throws NotFoundException when change request not found', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(null);
      await expect(service.approveChange('po-1', 'cr-missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when change request is not PENDING', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(pendingCr({ status: 'APPROVED' }));
      await expect(service.approveChange('po-1', 'cr-1', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ForbiddenException when approving own change request', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(pendingCr({ requestedById: 'ca-1' }));
      await expect(service.approveChange('po-1', 'cr-1', companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('applies PO-level field changes, bumps revision, resolves the CR, and audits with metadata', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(pendingCr());
      mockTx.poLineItem.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });

      const result = await service.approveChange('po-1', 'cr-1', companyAdmin);
      expect(result).toEqual({ approved: true });

      // PO-level field applied + revision bumped
      const poUpdate = mockTx.purchaseOrder.update.mock.calls.find(
        (c) => c[0].data.paymentTermsDays !== undefined,
      );
      expect(poUpdate[0].data).toEqual(
        expect.objectContaining({ paymentTermsDays: 10, revision: { increment: 1 } }),
      );

      // CR resolved
      expect(mockTx.poChangeRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cr-1' },
          data: expect.objectContaining({ status: 'APPROVED', resolvedById: 'ca-1' }),
        }),
      );

      // Audit carries the diff + names + reference
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PO_CHANGE_APPROVED',
          metadata: expect.objectContaining({
            changeRequestId: 'cr-1',
            reference: 'CR-002',
            changeType: 'COMMERCIAL',
            requestedByName: 'Vendor User',
            resolvedByName: 'CA Admin',
          }),
        }),
      );
    });

    it('applies per-line-item changes and recomputes lineTotal', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({
          changedFields: {
            lineItems: [
              {
                lineItemId: 'li-1',
                name: 'Steel',
                changes: { unitPrice: { from: 50, to: 80 } },
              },
            ],
          },
        }),
      );
      mockTx.poLineItem.findFirst.mockResolvedValue({
        id: 'li-1',
        purchaseOrderId: 'po-1',
        unitPrice: 50,
        quantityOrdered: 3,
      });
      mockTx.poLineItem.findMany.mockResolvedValue([{ lineTotal: 240, quantityOrdered: 3 }]);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });

      await service.approveChange('po-1', 'cr-1', companyAdmin);

      // unitPrice 80 × qty 3 = 240
      expect(mockTx.poLineItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'li-1' },
          data: expect.objectContaining({ unitPrice: 80, lineTotal: 240 }),
        }),
      );
    });

    it('applies every allowlisted PO-level field (dates, enums, strings, clears)', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({
          changedFields: {
            fields: {
              pickUpLocation: { from: 'Old', to: 'Dock 5' },
              pickUpTimeExpectation: { from: 'ASAP', to: 'CUSTOM_DATE' },
              pickUpPersonName: { from: null, to: 'Sam' },
              pickUpPersonPhone: { from: null, to: '0400000000' },
              plannedDeliveryDate: { from: null, to: '2026-08-01T00:00:00.000Z' },
              deliveryLocationId: { from: 'loc-a', to: 'loc-b' },
              deliveryNotes: { from: null, to: 'Leave at gate' },
              costCode: { from: 'CC-1', to: 'CC-2' },
              message: { from: null, to: 'Updated' },
              deliveryResponsibleName: { from: null, to: 'Jo' },
              deliveryResponsibleEmail: { from: null, to: 'jo@x.com' },
              // cleared to null
              paymentTermsDays: { from: 30, to: null },
              // unknown key is ignored (allowlist)
              someUnknownField: { from: 1, to: 2 },
            },
          },
        }),
      );
      mockTx.poLineItem.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });

      await service.approveChange('po-1', 'cr-1', companyAdmin);

      const poUpdate = mockTx.purchaseOrder.update.mock.calls.find(
        (c) => c[0].data.revision !== undefined,
      );
      expect(poUpdate[0].data).toEqual(
        expect.objectContaining({
          pickUpLocation: 'Dock 5',
          pickUpTimeExpectation: 'CUSTOM_DATE',
          pickUpPersonName: 'Sam',
          pickUpPersonPhone: '0400000000',
          plannedDeliveryDate: new Date('2026-08-01T00:00:00.000Z'),
          deliveryLocationId: 'loc-b',
          deliveryNotes: 'Leave at gate',
          costCode: 'CC-2',
          message: 'Updated',
          deliveryResponsibleName: 'Jo',
          deliveryResponsibleEmail: 'jo@x.com',
          paymentTermsDays: null,
        }),
      );
      expect(poUpdate[0].data).not.toHaveProperty('someUnknownField');
    });

    it('applies every allowlisted line-item field and ignores invalid scalars', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({
          changedFields: {
            lineItems: [
              {
                lineItemId: 'li-1',
                name: 'Steel',
                changes: {
                  quantityOrdered: { from: 3, to: 6 },
                  costCode: { from: 'CC-1', to: 'CC-9' },
                  expectedDeliveryDate: { from: null, to: '2026-09-01T00:00:00.000Z' },
                  description: { from: 'old', to: 'new desc' },
                  unitOfMeasure: { from: 'pcs', to: 'box' },
                  notes: { from: null, to: 'fragile' },
                  // object value is dropped by toNullableString
                  pickUp: { from: false, to: { weird: true } },
                },
              },
            ],
          },
        }),
      );
      mockTx.poLineItem.findFirst.mockResolvedValue({
        id: 'li-1',
        purchaseOrderId: 'po-1',
        unitPrice: 10,
        quantityOrdered: 3,
      });
      mockTx.poLineItem.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });

      await service.approveChange('po-1', 'cr-1', companyAdmin);

      const lineUpdate = mockTx.poLineItem.update.mock.calls[0][0];
      expect(lineUpdate.data).toEqual(
        expect.objectContaining({
          quantityOrdered: 6,
          costCode: 'CC-9',
          expectedDeliveryDate: new Date('2026-09-01T00:00:00.000Z'),
          description: 'new desc',
          unitOfMeasure: 'box',
          notes: 'fragile',
          // unitPrice unchanged (10) × new qty 6 = 60
          lineTotal: 60,
        }),
      );
    });

    it('clears numeric fields to null/zero when the change sets them to null', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({
          changedFields: {
            fields: { paymentTermsDays: { from: 30, to: null } },
            lineItems: [
              {
                lineItemId: 'li-1',
                name: 'Steel',
                changes: {
                  unitPrice: { from: 10, to: null },
                  quantityOrdered: { from: 3, to: undefined },
                },
              },
            ],
          },
        }),
      );
      mockTx.poLineItem.findFirst.mockResolvedValue({
        id: 'li-1',
        purchaseOrderId: 'po-1',
        unitPrice: 10,
        quantityOrdered: 3,
      });
      mockTx.poLineItem.findMany.mockResolvedValue([]);
      // resolver lookup returns null → resolvedByName falls back to user.email
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await service.approveChange('po-1', 'cr-1', companyAdmin);

      const lineUpdate = mockTx.poLineItem.update.mock.calls[0][0];
      // unitPrice → 0, quantityOrdered → 0, lineTotal = 0 × 0 = 0
      expect(lineUpdate.data).toEqual(
        expect.objectContaining({ unitPrice: 0, quantityOrdered: 0, lineTotal: 0 }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ resolvedByName: 'ca@test.com' }),
        }),
      );
    });

    it('tolerates a null reference and null changedFields when approving', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({ reference: null, changedFields: null }),
      );
      mockTx.poLineItem.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });

      const result = await service.approveChange('po-1', 'cr-1', companyAdmin);
      expect(result).toEqual({ approved: true });
      // Still bumps revision even with no field changes
      const poUpdate = mockTx.purchaseOrder.update.mock.calls.find(
        (c) => c[0].data.revision !== undefined,
      );
      expect(poUpdate[0].data.revision).toEqual({ increment: 1 });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ reference: null }) }),
      );
    });

    it('coerces an invalid date to null and an empty string to null', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({
          changedFields: {
            fields: {
              plannedDeliveryDate: { from: '2026-01-01', to: '' }, // empty date string → null
              deliveryNotes: { from: 'x', to: '' }, // empty string → null
            },
            lineItems: [
              {
                lineItemId: 'li-1',
                name: 'Steel',
                // invalid date on a line field → toNullableDate NaN branch → null
                changes: { expectedDeliveryDate: { from: '2026-02-02', to: 'bad-date' } },
              },
            ],
          },
        }),
      );
      mockTx.poLineItem.findFirst.mockResolvedValue({
        id: 'li-1',
        purchaseOrderId: 'po-1',
        unitPrice: 10,
        quantityOrdered: 2,
      });
      mockTx.poLineItem.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });

      await service.approveChange('po-1', 'cr-1', companyAdmin);

      const poUpdate = mockTx.purchaseOrder.update.mock.calls.find(
        (c) => c[0].data.revision !== undefined,
      );
      expect(poUpdate[0].data.plannedDeliveryDate).toBeNull();
      expect(poUpdate[0].data.deliveryNotes).toBeNull();
      // line-level invalid date coerced to null
      const lineUpdate = mockTx.poLineItem.update.mock.calls[0][0];
      expect(lineUpdate.data.expectedDeliveryDate).toBeNull();
    });

    it('does not email when the requester user is not found', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(pendingCr());
      mockTx.poLineItem.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ name: 'CA Admin' }) // resolver
        .mockResolvedValueOnce(null); // requester lookup → skip email

      await service.approveChange('po-1', 'cr-1', companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendChangeRequestApprovedEmail).not.toHaveBeenCalled();
    });

    it('stringifies boolean field values and ignores object field values', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({
          changedFields: {
            fields: {
              deliveryNotes: { from: null, to: true }, // boolean → "true"
              pickUpLocation: { from: 'x', to: { not: 'a scalar' } }, // object → dropped
            },
          },
        }),
      );
      mockTx.poLineItem.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });

      await service.approveChange('po-1', 'cr-1', companyAdmin);

      const poUpdate = mockTx.purchaseOrder.update.mock.calls.find(
        (c) => c[0].data.revision !== undefined,
      );
      expect(poUpdate[0].data.deliveryNotes).toBe('true');
      expect(poUpdate[0].data.pickUpLocation).toBeNull();
    });

    it('skips a line-item change whose target line does not belong to the PO', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({
          changedFields: {
            lineItems: [
              { lineItemId: 'missing', name: 'X', changes: { unitPrice: { from: 1, to: 2 } } },
            ],
          },
        }),
      );
      mockTx.poLineItem.findFirst.mockResolvedValue(null);
      mockTx.poLineItem.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });

      await service.approveChange('po-1', 'cr-1', companyAdmin);
      expect(mockTx.poLineItem.update).not.toHaveBeenCalled();
    });

    it('sends approved email to the change requester', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(pendingCr());
      mockTx.poLineItem.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ name: 'CA Admin' }) // resolver lookup
        .mockResolvedValueOnce({ email: 'vendor@test.com', role: UserRole.VENDOR }); // requester
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ poNumber: 'PO-0001' });

      await service.approveChange('po-1', 'cr-1', companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendChangeRequestApprovedEmail).toHaveBeenCalledWith(
        'vendor@test.com',
        'PO-0001',
        'http://localhost:5179/purchase-orders/po-1',
      );
    });
  });

  // ── rejectChange ──────────────────────────────────────────────────────────

  describe('rejectChange', () => {
    function pendingCr(overrides: Record<string, unknown> = {}) {
      return {
        id: 'cr-1',
        reference: 'CR-002',
        requestedById: 'v-u-1',
        status: 'PENDING',
        changeType: 'COMMERCIAL',
        changedFields: { fields: {} },
        requestedBy: { id: 'v-u-1', name: 'Vendor User' },
        ...overrides,
      };
    }

    it('throws NotFoundException when change request not found', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(null);
      await expect(
        service.rejectChange('po-1', 'cr-missing', { reason: 'No' }, companyAdmin),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when change request is not PENDING', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(pendingCr({ status: 'REJECTED' }));
      await expect(
        service.rejectChange('po-1', 'cr-1', { reason: 'No' }, companyAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when rejecting own change request', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(pendingCr({ requestedById: 'ca-1' }));
      await expect(
        service.rejectChange('po-1', 'cr-1', { reason: 'No' }, companyAdmin),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects with REJECTED status + reason and audits PO_CHANGE_REJECTED', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(pendingCr());
      mockPrisma.poChangeRequest.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });

      const result = await service.rejectChange(
        'po-1',
        'cr-1',
        { reason: 'Terms unacceptable' },
        companyAdmin,
      );

      expect(result).toEqual({ rejected: true });
      expect(mockPrisma.poChangeRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cr-1' },
          data: expect.objectContaining({
            status: 'REJECTED',
            reason: 'Terms unacceptable',
            resolvedById: 'ca-1',
          }),
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PO_CHANGE_REJECTED',
          metadata: expect.objectContaining({
            changeRequestId: 'cr-1',
            reason: 'Terms unacceptable',
            reference: 'CR-002',
          }),
        }),
      );
    });

    it('sends rejected email to the change requester', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(pendingCr());
      mockPrisma.poChangeRequest.update.mockResolvedValue({});
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ name: 'CA Admin' })
        .mockResolvedValueOnce({ email: 'vendor@test.com', role: UserRole.VENDOR });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ poNumber: 'PO-0001' });

      await service.rejectChange('po-1', 'cr-1', { reason: 'No' }, companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendChangeRequestRejectedEmail).toHaveBeenCalledWith(
        'vendor@test.com',
        'PO-0001',
        'http://localhost:5179/purchase-orders/po-1',
      );
    });

    it('does not fail when email sending throws', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(pendingCr());
      mockPrisma.poChangeRequest.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });
      mockEmailService.sendChangeRequestRejectedEmail.mockRejectedValue(new Error('SMTP down'));

      const result = await service.rejectChange('po-1', 'cr-1', { reason: 'No' }, companyAdmin);
      expect(result).toEqual({ rejected: true });
    });

    it('falls back to user.email for resolvedByName and stores null reason when omitted', async () => {
      // changedFields null exercises the `?? {}` fallback in the reject audit.
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(pendingCr({ changedFields: null }));
      mockPrisma.poChangeRequest.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(null); // resolver lookup → email fallback

      await service.rejectChange('po-1', 'cr-1', {}, companyAdmin);

      expect(mockPrisma.poChangeRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ reason: null }) }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ resolvedByName: 'ca@test.com', reason: null }),
        }),
      );
    });
  });

  // ── Access guard branches ──────────────────────────────────────────────────

  describe('access branches', () => {
    it('allows SUPER_ADMIN to list change requests without a company check', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        companyId: 'comp-1',
        vendorId: 'vendor-comp-1',
      });
      mockPrisma.poChangeRequest.findMany.mockResolvedValue([]);
      const superAdmin = {
        id: 's-1',
        email: 's@test.com',
        role: UserRole.SUPER_ADMIN,
        companyId: 'unrelated',
      };

      await expect(service.listChangeRequests('po-1', superAdmin as never)).resolves.toEqual([]);
    });

    it('allows the PO vendor to list change requests', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        companyId: 'comp-1',
        vendorId: 'vendor-comp-1',
      });
      mockPrisma.poChangeRequest.findMany.mockResolvedValue([]);
      await expect(service.listChangeRequests('po-1', vendorUser)).resolves.toEqual([]);
    });

    it('denies a contractor from a different company', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        companyId: 'comp-1',
        vendorId: 'vendor-comp-1',
      });
      const otherAdmin = {
        id: 'ca-2',
        email: 'x@test.com',
        role: UserRole.COMPANY_ADMIN,
        companyId: 'different-comp',
      };

      await expect(service.listChangeRequests('po-1', otherAdmin as never)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
