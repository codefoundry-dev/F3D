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
  poLineItem: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
  },
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
  material: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
  rfqVendorContact: { findMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockAuditService = { log: jest.fn() };

const mockEmailService = {
  sendPoChangeProposedEmail: jest.fn(),
  sendPoChangeApprovedEmail: jest.fn(),
  sendPoChangeRejectedEmail: jest.fn(),
  sendPoInternalChangeEmail: jest.fn(),
};

const mockNotifications = {
  createForEmails: jest.fn().mockResolvedValue(undefined),
  createForUsers: jest.fn().mockResolvedValue(undefined),
};

const mockAccessTokensService = {
  issueToken: jest.fn(),
};

const mockConfig = {
  get: jest.fn((_key: string, fallback: string) => fallback),
};

const mockBranding = {
  getEmailBrand: jest.fn().mockResolvedValue(undefined),
  getPdfBrand: jest.fn().mockResolvedValue(undefined),
};

describe('PoChangeService', () => {
  let service: PoChangeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PoChangeService(
      mockPrisma as never,
      mockAuditService as never,
      mockEmailService as never,
      mockAccessTokensService as never,
      mockConfig as never,
      mockBranding as never,
      mockNotifications as never,
    );
    mockEmailService.sendPoChangeProposedEmail.mockResolvedValue(undefined);
    mockEmailService.sendPoChangeApprovedEmail.mockResolvedValue(undefined);
    mockEmailService.sendPoChangeRejectedEmail.mockResolvedValue(undefined);
    mockEmailService.sendPoInternalChangeEmail.mockResolvedValue(undefined);
    mockNotifications.createForEmails.mockResolvedValue(undefined);
    mockAuditService.log.mockResolvedValue(undefined);
    // Default: no company logo → unbranded email. Re-set every test because
    // clearAllMocks keeps a brand override a FOR-288 test may have installed.
    mockBranding.getEmailBrand.mockResolvedValue(undefined);
    mockPrisma.poChangeRequest.count.mockResolvedValue(0);
    // Default: no sales-rep selection on a source RFQ (manual-PO shape), and a
    // fresh PO_VIEW token for unactivated change-request recipients.
    mockPrisma.rfqVendorContact.findMany.mockResolvedValue([]);
    mockAccessTokensService.issueToken.mockResolvedValue({
      token: 'crtoken1234567890.secretsecretsecret',
      record: { id: 'tok-cr' },
    });
    // The apply transaction invokes its callback with the tx client. (jest's
    // clearAllMocks above has already reset mockTx's call history.)
    mockTx.purchaseOrder.update.mockResolvedValue({});
    mockTx.poChangeRequest.update.mockResolvedValue({});
    mockTx.poLineItem.findMany.mockResolvedValue([]);
    mockTx.poLineItem.count.mockResolvedValue(2);
    mockTx.poLineItem.deleteMany.mockResolvedValue({ count: 0 });
    mockTx.poLineItem.create.mockResolvedValue({});
    mockTx.poLineItem.aggregate.mockResolvedValue({ _max: { lineNumber: 2 } });
    // Added-lines snapshot resolution: no catalogue materials by default.
    mockPrisma.material.findMany.mockResolvedValue([]);
    // Propose-time removal validation reads the PO's current lines.
    mockPrisma.poLineItem.findMany.mockResolvedValue([{ id: 'li-1' }, { id: 'li-2' }]);
    mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockTx) => unknown) => cb(mockTx));
  });

  // ── proposeChange ─────────────────────────────────────────────────────────

  describe('proposeChange', () => {
    const poWithRelations = {
      id: 'po-1',
      status: 'SENT',
      companyId: 'comp-1',
      vendorId: 'vendor-comp-1',
      rfqId: null,
      poNumber: 'PO-0001',
      company: { users: [{ email: 'admin@contractor.com' }] },
      vendor: {
        contactEmail: 'contact@vendor.com',
        users: [{ email: 'vendor@vendor.com', status: 'ACTIVE' }],
      },
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

    it('rejects a proposal that would remove every line item (FOR-352)', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poLineItem.findMany.mockResolvedValue([{ id: 'li-1' }, { id: 'li-2' }]);

      const removeAllDto = {
        changeType: 'COMMERCIAL',
        changedFields: {
          removedLineItems: [
            { lineItemId: 'li-1', name: 'A' },
            { lineItemId: 'li-2', name: 'B' },
          ],
        },
      };
      await expect(
        service.proposeChange('po-1', removeAllDto as never, companyAdmin),
      ).rejects.toThrow('Cannot remove every line item');
      expect(mockPrisma.poChangeRequest.create).not.toHaveBeenCalled();
    });

    it('accepts a proposal that removes only some line items (FOR-352)', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poLineItem.findMany.mockResolvedValue([{ id: 'li-1' }, { id: 'li-2' }]);
      mockPrisma.poChangeRequest.create.mockResolvedValue(
        createdCr({
          changedFields: { removedLineItems: [{ lineItemId: 'li-1', name: 'A' }] },
        }),
      );

      const partialDto = {
        changeType: 'COMMERCIAL',
        changedFields: { removedLineItems: [{ lineItemId: 'li-1', name: 'A' }] },
      };
      const result = await service.proposeChange('po-1', partialDto as never, companyAdmin);
      expect(result.id).toBe('cr-1');
    });

    it('skips the removal guard for a cancellation proposal (FOR-352)', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poChangeRequest.create.mockResolvedValue(
        createdCr({ changedFields: { cancelPo: true } }),
      );

      const cancelDto = { changeType: 'COMMERCIAL', changedFields: { cancelPo: true } };
      const result = await service.proposeChange('po-1', cancelDto as never, companyAdmin);
      expect(result.id).toBe('cr-1');
      // A cancellation never needs the PO's lines.
      expect(mockPrisma.poLineItem.findMany).not.toHaveBeenCalled();
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

      expect(mockEmailService.sendPoChangeProposedEmail).toHaveBeenCalledWith(
        'admin@contractor.com',
        'PO-0001',
        'Vendor User',
        'http://localhost:5179/purchase-orders/po-1',
        expect.objectContaining({ brand: undefined }),
      );
    });

    it("includes the proposer's message as the user comment and mirrors into the in-app feed", async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poChangeRequest.create.mockResolvedValue(createdCr());

      await service.proposeChange('po-1', dto as never, vendorUser);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoChangeProposedEmail).toHaveBeenCalledWith(
        'admin@contractor.com',
        'PO-0001',
        'Vendor User',
        'http://localhost:5179/purchase-orders/po-1',
        expect.objectContaining({
          comment: 'Please update terms',
          log: { companyId: 'comp-1', purchaseOrderId: 'po-1', sentByUserId: 'v-u-1' },
        }),
      );
      expect(mockNotifications.createForEmails).toHaveBeenCalledWith(
        ['admin@contractor.com'],
        expect.objectContaining({
          type: 'CHANGE_REQUEST_PROPOSED',
          entityType: 'PURCHASE_ORDER',
          entityId: 'po-1',
        }),
      );
    });

    it('sends the "PO updated" pair for an INTERNAL change, which needs no approval', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poChangeRequest.create.mockResolvedValue(createdCr({ changeType: 'INTERNAL' }));

      await service.proposeChange('po-1', { ...dto, changeType: 'INTERNAL' } as never, vendorUser);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoInternalChangeEmail).toHaveBeenCalledWith(
        'admin@contractor.com',
        'PO-0001',
        'Vendor User',
        'http://localhost:5179/purchase-orders/po-1',
        expect.objectContaining({ brand: undefined }),
      );
      expect(mockEmailService.sendPoChangeProposedEmail).not.toHaveBeenCalled();
      expect(mockNotifications.createForEmails).toHaveBeenCalledWith(
        ['admin@contractor.com'],
        expect.objectContaining({ type: 'PO_INTERNAL_CHANGE' }),
      );
    });

    it('forwards the issuing company brand on the proposed-change email (FOR-288)', async () => {
      const brand = { name: 'TestCo', logoUrl: 'https://cdn.test/testco.png' };
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poChangeRequest.create.mockResolvedValue(createdCr());
      mockBranding.getEmailBrand.mockResolvedValue(brand);

      await service.proposeChange('po-1', dto as never, vendorUser);
      await new Promise((r) => setTimeout(r, 10));

      // Resolved from the PO's own (issuing/buyer) company id.
      expect(mockBranding.getEmailBrand).toHaveBeenCalledWith('comp-1');
      expect(mockEmailService.sendPoChangeProposedEmail).toHaveBeenCalledWith(
        'admin@contractor.com',
        'PO-0001',
        'Vendor User',
        'http://localhost:5179/purchase-orders/po-1',
        expect.objectContaining({ brand }),
      );
    });

    it('sends email to vendor when contractor proposes a change', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poChangeRequest.create.mockResolvedValue(
        createdCr({ requestedBy: { id: 'ca-1', name: 'CA Admin', company: { legalName: 'Con' } } }),
      );

      await service.proposeChange('po-1', dto as never, companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoChangeProposedEmail).toHaveBeenCalledWith(
        'vendor@vendor.com',
        'PO-0001',
        'CA Admin',
        'http://localhost:5179/purchase-orders/po-1',
        expect.objectContaining({ brand: undefined }),
      );
    });

    it('sends the tokenised portal link to the contactEmail of a vendor with no user accounts', async () => {
      // A quick-added vendor (US-3.01) cannot log in — the change-request email
      // now carries the tokenised PO link (re-minted; the 30-day issue token may
      // have lapsed) instead of a login-walled authenticated route.
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...poWithRelations,
        vendor: { contactEmail: 'quickadd@vendor.com', users: [] },
      });
      mockPrisma.poChangeRequest.create.mockResolvedValue(
        createdCr({ requestedBy: { id: 'ca-1', name: 'CA Admin', company: { legalName: 'Con' } } }),
      );

      await service.proposeChange('po-1', dto as never, companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockAccessTokensService.issueToken).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectType: 'PURCHASE_ORDER',
          subjectId: 'po-1',
          purpose: 'PO_VIEW',
          ttlMs: 30 * 24 * 60 * 60 * 1000,
        }),
      );
      expect(mockEmailService.sendPoChangeProposedEmail).toHaveBeenCalledWith(
        'quickadd@vendor.com',
        'PO-0001',
        'CA Admin',
        'http://localhost:5179/po/crtoken1234567890.secretsecretsecret',
        expect.objectContaining({ brand: undefined }),
      );
    });

    it('chooses the link per recipient for a vendor with mixed activation states', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...poWithRelations,
        vendor: {
          contactEmail: null,
          users: [
            { email: 'active@vendor.com', status: 'ACTIVE' },
            { email: 'rep@vendor.com', status: 'INVITED' },
          ],
        },
      });
      mockPrisma.poChangeRequest.create.mockResolvedValue(
        createdCr({ requestedBy: { id: 'ca-1', name: 'CA Admin', company: { legalName: 'Con' } } }),
      );

      await service.proposeChange('po-1', dto as never, companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoChangeProposedEmail).toHaveBeenCalledTimes(2);
      expect(mockEmailService.sendPoChangeProposedEmail).toHaveBeenCalledWith(
        'active@vendor.com',
        'PO-0001',
        'CA Admin',
        'http://localhost:5179/purchase-orders/po-1',
        expect.objectContaining({ brand: undefined }),
      );
      expect(mockEmailService.sendPoChangeProposedEmail).toHaveBeenCalledWith(
        'rep@vendor.com',
        'PO-0001',
        'CA Admin',
        'http://localhost:5179/po/crtoken1234567890.secretsecretsecret',
        expect.objectContaining({ brand: undefined }),
      );
    });

    it('does not mint a token when every vendor recipient is activated', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poChangeRequest.create.mockResolvedValue(
        createdCr({ requestedBy: { id: 'ca-1', name: 'CA Admin', company: { legalName: 'Con' } } }),
      );

      await service.proposeChange('po-1', dto as never, companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockAccessTokensService.issueToken).not.toHaveBeenCalled();
    });

    it('honours the sales reps selected on the source RFQ over the vendor user list', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...poWithRelations,
        rfqId: 'rfq-1',
      });
      mockPrisma.rfqVendorContact.findMany.mockResolvedValue([
        { user: { email: 'chosen-rep@vendor.com', status: 'INVITED' } },
      ]);
      mockPrisma.poChangeRequest.create.mockResolvedValue(
        createdCr({ requestedBy: { id: 'ca-1', name: 'CA Admin', company: { legalName: 'Con' } } }),
      );

      await service.proposeChange('po-1', dto as never, companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockPrisma.rfqVendorContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { rfqVendor: { rfqId: 'rfq-1', vendorId: 'vendor-comp-1' } },
        }),
      );
      expect(mockEmailService.sendPoChangeProposedEmail).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendPoChangeProposedEmail).toHaveBeenCalledWith(
        'chosen-rep@vendor.com',
        'PO-0001',
        'CA Admin',
        'http://localhost:5179/po/crtoken1234567890.secretsecretsecret',
        expect.objectContaining({ brand: undefined }),
      );
    });

    it('degrades to the authenticated link when token minting fails', async () => {
      // The email must still go out — a login-walled link with the PO number is
      // better than no notification at all.
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        ...poWithRelations,
        vendor: { contactEmail: 'quickadd@vendor.com', users: [] },
      });
      mockAccessTokensService.issueToken.mockRejectedValue(new Error('mint failed'));
      mockPrisma.poChangeRequest.create.mockResolvedValue(
        createdCr({ requestedBy: { id: 'ca-1', name: 'CA Admin', company: { legalName: 'Con' } } }),
      );

      await service.proposeChange('po-1', dto as never, companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoChangeProposedEmail).toHaveBeenCalledWith(
        'quickadd@vendor.com',
        'PO-0001',
        'CA Admin',
        'http://localhost:5179/purchase-orders/po-1',
        expect.objectContaining({ brand: undefined }),
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

      expect(mockEmailService.sendPoChangeProposedEmail).toHaveBeenCalledWith(
        'only@vendor.com',
        'PO-0001',
        'CA Admin',
        expect.any(String),
        expect.objectContaining({ brand: undefined }),
      );
    });

    it('does not fail when email sending throws', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poWithRelations);
      mockPrisma.poChangeRequest.create.mockResolvedValue(createdCr());
      mockEmailService.sendPoChangeProposedEmail.mockRejectedValue(new Error('SMTP down'));

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
      expect(mockEmailService.sendPoChangeProposedEmail).not.toHaveBeenCalled();
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
      expect(mockEmailService.sendPoChangeProposedEmail).toHaveBeenCalledWith(
        'admin@contractor.com',
        'PO-0001',
        'A user',
        'http://localhost:5179/purchase-orders/po-1',
        expect.objectContaining({ brand: undefined }),
      );
    });
  });

  // ── proposeChangeViaToken (guest portal) ──────────────────────────────────

  describe('proposeChangeViaToken', () => {
    const guestPo = {
      id: 'po-1',
      status: 'SENT',
      companyId: 'comp-1',
      vendorId: 'vendor-comp-1',
      rfqId: null,
      poNumber: 'PO-0001',
      company: { users: [{ email: 'admin@contractor.com' }] },
      vendor: { legalName: 'VendorCo', tradeName: 'Vendor', contactEmail: 'contact@vendor.com' },
    };

    const dto = {
      changeType: 'COMMERCIAL',
      changedFields: { lineItems: [{ lineItemId: 'li-1', name: 'Item', changes: {} }] },
      message: 'We can only ship next week',
    };

    it('throws NotFoundException when PO not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.proposeChangeViaToken('missing', dto as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the PO status disallows changes', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ ...guestPo, status: 'DRAFT' });
      await expect(service.proposeChangeViaToken('po-1', dto as never)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a guest proposal that would remove every line item (FOR-352)', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(guestPo);
      mockPrisma.poLineItem.findMany.mockResolvedValue([{ id: 'li-1' }]);

      const removeAllDto = {
        changeType: 'COMMERCIAL',
        changedFields: { removedLineItems: [{ lineItemId: 'li-1', name: 'A' }] },
      };
      await expect(service.proposeChangeViaToken('po-1', removeAllDto as never)).rejects.toThrow(
        'Cannot remove every line item',
      );
      expect(mockPrisma.poChangeRequest.create).not.toHaveBeenCalled();
    });

    it('creates a CR with no requester user, attributed by the vendor label', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(guestPo);
      mockPrisma.poChangeRequest.count.mockResolvedValue(2);
      mockPrisma.poChangeRequest.create.mockImplementation(({ data }: never) => ({
        id: 'cr-9',
        purchaseOrderId: 'po-1',
        reference: (data as { reference: string }).reference,
        changeType: 'COMMERCIAL',
        changedFields: dto.changedFields,
        message: dto.message,
        status: 'PENDING',
        reason: null,
        requestedByLabel: (data as { requestedByLabel: string }).requestedByLabel,
        resolvedAt: null,
        createdAt: new Date('2026-07-20T00:00:00.000Z'),
      }));

      const result = await service.proposeChangeViaToken('po-1', dto as never);

      // Stored with a null requester + the vendor's name as the label.
      const createArg = mockPrisma.poChangeRequest.create.mock.calls[0][0];
      expect(createArg.data.requestedById).toBeNull();
      expect(createArg.data.requestedByLabel).toBe('VendorCo');
      expect(createArg.data.reference).toBe('CR-003');
      // The response surfaces the label where a name would normally go.
      expect(result.requestedByName).toBe('VendorCo');
    });

    it('audits the proposal as a guest (no performedById) with a label', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(guestPo);
      mockPrisma.poChangeRequest.create.mockResolvedValue({
        id: 'cr-9',
        purchaseOrderId: 'po-1',
        reference: 'CR-001',
        changeType: 'COMMERCIAL',
        changedFields: dto.changedFields,
        message: dto.message,
        status: 'PENDING',
        reason: null,
        requestedByLabel: 'VendorCo',
        resolvedAt: null,
        createdAt: new Date('2026-07-20T00:00:00.000Z'),
      });

      await service.proposeChangeViaToken('po-1', dto as never);

      const auditArg = mockAuditService.log.mock.calls[0][0];
      expect(auditArg.performedById).toBeNull();
      expect(auditArg.performedByLabel).toBeTruthy();
    });

    it('notifies the contractor admins (never the vendor) with the authenticated link', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(guestPo);
      mockPrisma.poChangeRequest.create.mockResolvedValue({
        id: 'cr-9',
        purchaseOrderId: 'po-1',
        reference: 'CR-001',
        changeType: 'COMMERCIAL',
        changedFields: dto.changedFields,
        message: dto.message,
        status: 'PENDING',
        reason: null,
        requestedByLabel: 'VendorCo',
        resolvedAt: null,
        createdAt: new Date('2026-07-20T00:00:00.000Z'),
      });

      await service.proposeChangeViaToken('po-1', dto as never);

      expect(mockEmailService.sendPoChangeProposedEmail).toHaveBeenCalledWith(
        'admin@contractor.com',
        'PO-0001',
        'VendorCo',
        'http://localhost:5179/purchase-orders/po-1',
        expect.objectContaining({ brand: undefined }),
      );
      // No tokenised link is minted — the contractor has an account.
      expect(mockAccessTokensService.issueToken).not.toHaveBeenCalled();
    });
  });

  // ── listChangeRequestsViaToken (guest portal) ─────────────────────────────

  describe('listChangeRequestsViaToken', () => {
    it('throws NotFoundException when PO not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.listChangeRequestsViaToken('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the shaped change requests without an access check', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1' });
      mockPrisma.poChangeRequest.findMany.mockResolvedValue([
        {
          id: 'cr-1',
          purchaseOrderId: 'po-1',
          reference: 'CR-001',
          changeType: 'COMMERCIAL',
          changedFields: { fields: {} },
          message: null,
          status: 'PENDING',
          reason: null,
          requestedByLabel: 'VendorCo',
          resolvedAt: null,
          createdAt: new Date('2026-07-20T00:00:00.000Z'),
          requestedBy: null,
          resolvedBy: null,
        },
      ]);

      const result = await service.listChangeRequestsViaToken('po-1');
      expect(result).toHaveLength(1);
      expect(result[0].requestedByName).toBe('VendorCo');
    });
  });

  // ── listChangeRequests ────────────────────────────────────────────────────

  describe('listChangeRequests', () => {
    it('denies a vendor user with no company on a PO that has no vendor yet', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        companyId: 'comp-1',
        vendorId: null,
      });
      await expect(
        service.listChangeRequests('po-1', { ...vendorUser, companyId: null } as never),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.poChangeRequest.findMany).not.toHaveBeenCalled();
    });

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
        purchaseOrderId: 'po-1',
        reference: 'CR-002',
        requestedById: 'v-u-1',
        status: 'PENDING',
        changeType: 'COMMERCIAL',
        changedFields: { fields: { paymentTermsDays: { from: 30, to: 10 } } },
        requestedBy: { id: 'v-u-1', name: 'Vendor User', role: UserRole.VENDOR },
        ...overrides,
      };
    }

    // The access-check PO load that now precedes the CR lookup. Tests that
    // exercise the notify fan-out override this with a richer object.
    beforeEach(() => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'SENT',
        companyId: 'comp-1',
        vendorId: 'vendor-comp-1',
        poNumber: 'PO-0001',
        rfqId: null,
      });
    });

    it('throws NotFoundException when the PO is not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.approveChange('missing', 'cr-1', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('denies an admin from a different company (validateAccess)', async () => {
      const otherAdmin = {
        id: 'ca-2',
        email: 'x@test.com',
        role: UserRole.COMPANY_ADMIN,
        companyId: 'different-comp',
      };
      await expect(service.approveChange('po-1', 'cr-1', otherAdmin as never)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when the CR belongs to a different PO', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({ purchaseOrderId: 'po-OTHER' }),
      );
      await expect(service.approveChange('po-1', 'cr-1', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

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

      expect(mockEmailService.sendPoChangeApprovedEmail).not.toHaveBeenCalled();
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
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'SENT',
        companyId: 'comp-1',
        vendorId: 'vendor-comp-1',
        rfqId: null,
        poNumber: 'PO-0001',
      });

      await service.approveChange('po-1', 'cr-1', companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoChangeApprovedEmail).toHaveBeenCalledWith(
        'vendor@test.com',
        'PO-0001',
        'http://localhost:5179/purchase-orders/po-1',
        expect.objectContaining({ brand: undefined }),
      );
    });

    it('forwards the issuing company brand on the approved-change email (FOR-288)', async () => {
      const brand = { name: 'TestCo', logoUrl: 'https://cdn.test/testco.png' };
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(pendingCr());
      mockTx.poLineItem.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ name: 'CA Admin' }) // resolver lookup
        .mockResolvedValueOnce({ email: 'vendor@test.com', role: UserRole.VENDOR }); // requester
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'SENT',
        vendorId: 'vendor-comp-1',
        rfqId: null,
        poNumber: 'PO-0001',
        companyId: 'comp-1',
      });
      mockBranding.getEmailBrand.mockResolvedValue(brand);

      await service.approveChange('po-1', 'cr-1', companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      // Resolved from the PO's own (issuing/buyer) company id.
      expect(mockBranding.getEmailBrand).toHaveBeenCalledWith('comp-1');
      expect(mockEmailService.sendPoChangeApprovedEmail).toHaveBeenCalledWith(
        'vendor@test.com',
        'PO-0001',
        'http://localhost:5179/purchase-orders/po-1',
        expect.objectContaining({ brand }),
      );
    });

    it('notifies the vendor with a tokenised link when the requester was a guest', async () => {
      // A guest-proposed CR has no requester user (requestedById null); the
      // outcome must still reach the vendor via a tokenised portal link.
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({ requestedById: null, requestedBy: null }),
      );
      mockTx.poLineItem.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' }); // resolver only
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'SENT',
        companyId: 'comp-1',
        poNumber: 'PO-0001',
        vendorId: 'vendor-comp-1',
        rfqId: null,
        vendor: { contactEmail: 'contact@vendor.com', users: [] },
      });

      await service.approveChange('po-1', 'cr-1', companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoChangeApprovedEmail).toHaveBeenCalledWith(
        'contact@vendor.com',
        'PO-0001',
        'http://localhost:5179/po/crtoken1234567890.secretsecretsecret',
        expect.objectContaining({ brand: undefined }),
      );
    });

    it('reaches the requester and the other party, once each, and mirrors into the feed', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(pendingCr());
      mockTx.poLineItem.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ name: 'CA Admin' }) // resolver lookup
        .mockResolvedValueOnce({ email: 'vendor@test.com' }); // requester
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'SENT',
        poNumber: 'PO-0001',
        companyId: 'comp-1',
        vendorId: 'vendor-comp-1',
        rfqId: null,
        // The contractor admin also appears as a vendor recipient — the fan-out
        // must not email the same address twice.
        company: { users: [{ email: 'admin@contractor.com' }] },
        vendor: {
          contactEmail: null,
          users: [
            { email: 'vendor@test.com', status: 'ACTIVE' },
            { email: 'admin@contractor.com', status: 'ACTIVE' },
          ],
        },
      });

      await service.approveChange('po-1', 'cr-1', companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoChangeApprovedEmail).toHaveBeenCalledTimes(2);
      const addressed = mockEmailService.sendPoChangeApprovedEmail.mock.calls.map(
        (c: unknown[]) => c[0],
      );
      expect(addressed.sort()).toEqual(['admin@contractor.com', 'vendor@test.com']);

      expect(mockNotifications.createForEmails).toHaveBeenCalledWith(
        expect.arrayContaining(['admin@contractor.com', 'vendor@test.com']),
        expect.objectContaining({
          type: 'CHANGE_REQUEST_APPROVED',
          entityType: 'PURCHASE_ORDER',
          entityId: 'po-1',
        }),
      );
    });

    // ── FOR-352: cancellation requests ──────────────────────────────────────

    it('cancels the PO when approving a contractor-requested cancellation', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({
          changedFields: { cancelPo: true },
          message: 'Project descoped',
          requestedById: 'other-ca',
          requestedBy: { id: 'other-ca', name: 'Other Admin', role: UserRole.COMPANY_ADMIN },
        }),
      );
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });

      const result = await service.approveChange('po-1', 'cr-1', companyAdmin);
      expect(result).toEqual({ approved: true });

      expect(mockTx.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'po-1' },
          data: expect.objectContaining({
            status: 'CANCELLED',
            cancellationReason: 'Project descoped',
            lastModifiedById: 'ca-1',
          }),
        }),
      );
      expect(mockTx.poChangeRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cr-1' },
          data: expect.objectContaining({ status: 'APPROVED', resolvedById: 'ca-1' }),
        }),
      );
      // Cancellation supersedes the field-apply path: single PO update, no
      // revision bump, no line recompute.
      expect(mockTx.purchaseOrder.update).toHaveBeenCalledTimes(1);
      expect(mockTx.purchaseOrder.update.mock.calls[0][0].data.revision).toBeUndefined();

      // Both the CR resolution and the transition itself are audited.
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PO_CHANGE_APPROVED' }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PO_CANCELLED',
          metadata: expect.objectContaining({
            from: 'SENT',
            to: 'CANCELLED',
            reason: 'Project descoped',
            changeRequestId: 'cr-1',
          }),
        }),
      );
    });

    it('cancels to CANCELLED_BY_VENDOR when the requester is a vendor user', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({ changedFields: { cancelPo: true }, message: null }),
      );
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });

      await service.approveChange('po-1', 'cr-1', companyAdmin);

      const update = mockTx.purchaseOrder.update.mock.calls[0][0];
      expect(update.data.status).toBe('CANCELLED_BY_VENDOR');
      // No message → cancellationReason left untouched.
      expect(update.data).not.toHaveProperty('cancellationReason');
    });

    it('cancels to CANCELLED_BY_VENDOR when the requester was a guest (portal token)', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({
          changedFields: { cancelPo: true },
          message: 'Cannot fulfil',
          requestedById: null,
          requestedBy: null,
        }),
      );
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });

      await service.approveChange('po-1', 'cr-1', companyAdmin);

      expect(mockTx.purchaseOrder.update.mock.calls[0][0].data.status).toBe('CANCELLED_BY_VENDOR');
    });

    it('rejects a cancellation approval when the PO can no longer be cancelled', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DELIVERED',
        companyId: 'comp-1',
        vendorId: 'vendor-comp-1',
        poNumber: 'PO-0001',
        rfqId: null,
      });
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({ changedFields: { cancelPo: true } }),
      );

      await expect(service.approveChange('po-1', 'cr-1', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTx.purchaseOrder.update).not.toHaveBeenCalled();
    });

    // ── FOR-352: line-item removals ─────────────────────────────────────────

    it('deletes removed line items and recomputes totals from the survivors', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({
          changedFields: { removedLineItems: [{ lineItemId: 'li-2', name: 'Copper pipe' }] },
        }),
      );
      mockTx.poLineItem.findMany
        // Removal-candidate lookup (with delivery counts)
        .mockResolvedValueOnce([
          { id: 'li-2', quantityDelivered: 0, _count: { deliveryReportLines: 0 } },
        ])
        // Totals recompute over the surviving lines
        .mockResolvedValueOnce([{ lineTotal: 100, quantityOrdered: 2 }]);
      mockTx.poLineItem.count.mockResolvedValue(2);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });

      await service.approveChange('po-1', 'cr-1', companyAdmin);

      expect(mockTx.poLineItem.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['li-2'] } },
      });
      const totalsUpdate = mockTx.purchaseOrder.update.mock.calls.find(
        (c) => c[0].data.subtotal !== undefined,
      );
      expect(totalsUpdate[0].data).toEqual(
        expect.objectContaining({
          subtotal: 100,
          totalAmount: 100,
          lineItemCount: 1,
          totalRequestedQty: 2,
        }),
      );
    });

    it('refuses to remove a line that already has recorded deliveries', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({
          changedFields: { removedLineItems: [{ lineItemId: 'li-2', name: 'Copper pipe' }] },
        }),
      );
      mockTx.poLineItem.findMany.mockResolvedValueOnce([
        { id: 'li-2', quantityDelivered: 3, _count: { deliveryReportLines: 1 } },
      ]);

      await expect(service.approveChange('po-1', 'cr-1', companyAdmin)).rejects.toThrow(
        'Cannot remove a line item that already has recorded deliveries',
      );
      expect(mockTx.poLineItem.deleteMany).not.toHaveBeenCalled();
    });

    it('refuses to remove every line item on apply', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({
          changedFields: {
            removedLineItems: [
              { lineItemId: 'li-1', name: 'A' },
              { lineItemId: 'li-2', name: 'B' },
            ],
          },
        }),
      );
      mockTx.poLineItem.findMany.mockResolvedValueOnce([
        { id: 'li-1', quantityDelivered: 0, _count: { deliveryReportLines: 0 } },
        { id: 'li-2', quantityDelivered: 0, _count: { deliveryReportLines: 0 } },
      ]);
      mockTx.poLineItem.count.mockResolvedValue(2);

      await expect(service.approveChange('po-1', 'cr-1', companyAdmin)).rejects.toThrow(
        'Cannot remove every line item',
      );
      expect(mockTx.poLineItem.deleteMany).not.toHaveBeenCalled();
    });

    it('ignores removal entries whose line does not belong to the PO', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({
          changedFields: { removedLineItems: [{ lineItemId: 'foreign-line', name: 'X' }] },
        }),
      );
      // The scoped lookup finds nothing → nothing to delete.
      mockTx.poLineItem.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ lineTotal: 50, quantityOrdered: 1 }]);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });

      await service.approveChange('po-1', 'cr-1', companyAdmin);

      expect(mockTx.poLineItem.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [] } } });
    });

    it('creates added line items with sequential line numbers, snapshots, and computed lineTotal', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({
          changedFields: {
            addedLineItems: [
              {
                name: 'Steel Bolt M10',
                quantityOrdered: 4,
                unitOfMeasure: 'EA',
                unitPrice: 2.5,
                notes: 'urgent',
              },
              {
                name: 'Catalogue Beam',
                materialId: 'mat-1',
                quantityOrdered: 2,
                unitOfMeasure: 'EA',
                unitPrice: 100,
              },
            ],
          },
        }),
      );
      mockPrisma.material.findMany.mockResolvedValue([
        {
          id: 'mat-1',
          upc: 'UPC-1',
          manufacturerPartNumber: 'MPN-1',
          costCode: 'CC-1',
          taxCode: 'TX-1',
        },
      ]);
      mockTx.poLineItem.aggregate.mockResolvedValue({ _max: { lineNumber: 3 } });
      mockTx.poLineItem.findMany.mockResolvedValue([
        { lineTotal: 10, quantityOrdered: 4 },
        { lineTotal: 200, quantityOrdered: 2 },
      ]);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });

      await service.approveChange('po-1', 'cr-1', companyAdmin);

      expect(mockTx.poLineItem.create).toHaveBeenCalledTimes(2);
      // Manual-name line: the name lands in description; no catalogue material.
      expect(mockTx.poLineItem.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          purchaseOrderId: 'po-1',
          lineNumber: 4,
          materialId: null,
          description: 'Steel Bolt M10',
          quantityOrdered: 4,
          unitOfMeasure: 'EA',
          unitPrice: 2.5,
          lineTotal: 10,
          notes: 'urgent',
        }),
      });
      // Catalogue line: materialId kept, snapshot fields resolved from the material.
      expect(mockTx.poLineItem.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          lineNumber: 5,
          materialId: 'mat-1',
          upc: 'UPC-1',
          manufacturerPartNumber: 'MPN-1',
          costCode: 'CC-1',
          taxCode: 'TX-1',
          lineTotal: 200,
        }),
      });
      // Totals recomputed over all lines, including the new ones.
      const totalsUpdate = mockTx.purchaseOrder.update.mock.calls.find(
        (c) => c[0].data.subtotal !== undefined,
      );
      expect(totalsUpdate[0].data).toEqual(
        expect.objectContaining({ subtotal: 210, lineItemCount: 2, totalRequestedQty: 6 }),
      );
    });

    it('skips invalid added entries and drops an unresolvable materialId', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({
          changedFields: {
            addedLineItems: [
              // qty < 1 → skipped
              { name: 'No qty', quantityOrdered: 0, unitOfMeasure: 'EA', unitPrice: 5 },
              // no unit of measure → skipped
              { name: 'No uom', quantityOrdered: 2, unitPrice: 5 },
              // ghost materialId → created without the material link
              {
                name: 'Ghost material',
                materialId: 'mat-ghost',
                quantityOrdered: 1,
                unitOfMeasure: 'EA',
                unitPrice: 5,
              },
            ],
          },
        }),
      );
      mockTx.poLineItem.findMany.mockResolvedValue([{ lineTotal: 5, quantityOrdered: 1 }]);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });

      await service.approveChange('po-1', 'cr-1', companyAdmin);

      expect(mockTx.poLineItem.create).toHaveBeenCalledTimes(1);
      expect(mockTx.poLineItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ materialId: null, description: 'Ghost material' }),
      });
    });

    it('does not touch the added-lines path when the CR carries none', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(pendingCr());
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });

      await service.approveChange('po-1', 'cr-1', companyAdmin);

      expect(mockTx.poLineItem.aggregate).not.toHaveBeenCalled();
      expect(mockTx.poLineItem.create).not.toHaveBeenCalled();
    });
  });

  // ── rejectChange ──────────────────────────────────────────────────────────

  describe('rejectChange', () => {
    function pendingCr(overrides: Record<string, unknown> = {}) {
      return {
        id: 'cr-1',
        purchaseOrderId: 'po-1',
        reference: 'CR-002',
        requestedById: 'v-u-1',
        status: 'PENDING',
        changeType: 'COMMERCIAL',
        changedFields: { fields: {} },
        requestedBy: { id: 'v-u-1', name: 'Vendor User' },
        ...overrides,
      };
    }

    // The access-check PO load that now precedes the CR lookup.
    beforeEach(() => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        companyId: 'comp-1',
        vendorId: 'vendor-comp-1',
      });
    });

    it('throws NotFoundException when the PO is not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(
        service.rejectChange('missing', 'cr-1', { reason: 'No' }, companyAdmin),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the CR belongs to a different PO', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(
        pendingCr({ purchaseOrderId: 'po-OTHER' }),
      );
      await expect(
        service.rejectChange('po-1', 'cr-1', { reason: 'No' }, companyAdmin),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.poChangeRequest.update).not.toHaveBeenCalled();
    });

    it('denies an admin from a different company (validateAccess)', async () => {
      const otherAdmin = {
        id: 'ca-2',
        email: 'x@test.com',
        role: UserRole.COMPANY_ADMIN,
        companyId: 'different-comp',
      };
      await expect(
        service.rejectChange('po-1', 'cr-1', { reason: 'No' }, otherAdmin as never),
      ).rejects.toThrow(ForbiddenException);
    });

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
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        companyId: 'comp-1',
        vendorId: 'vendor-comp-1',
        rfqId: null,
        poNumber: 'PO-0001',
      });

      await service.rejectChange('po-1', 'cr-1', { reason: 'No' }, companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendPoChangeRejectedEmail).toHaveBeenCalledWith(
        'vendor@test.com',
        'PO-0001',
        'http://localhost:5179/purchase-orders/po-1',
        expect.objectContaining({ brand: undefined }),
      );
    });

    it('does not fail when email sending throws', async () => {
      mockPrisma.poChangeRequest.findUnique.mockResolvedValue(pendingCr());
      mockPrisma.poChangeRequest.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'CA Admin' });
      mockEmailService.sendPoChangeRejectedEmail.mockRejectedValue(new Error('SMTP down'));

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
