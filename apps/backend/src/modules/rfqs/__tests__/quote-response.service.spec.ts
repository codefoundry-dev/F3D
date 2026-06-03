import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { QuoteResponseService } from '../quote-response.service';

const mockPrisma = {
  rfq: { findUnique: jest.fn() },
  rfqVendor: { findUnique: jest.fn() },
  quoteResponse: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
  quoteAudit: { findMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockAuditService = {
  log: jest.fn(),
};

const mockAccessTokens = {
  validateToken: jest.fn(),
  consumeToken: jest.fn(),
};

const mockStorage = {
  getSignedUrl: jest.fn(),
};

const mockDocIntelligence = {
  createGuestQuoteExtraction: jest.fn(),
  getGuestQuoteExtraction: jest.fn(),
};

/** Build a $transaction tx stub whose quoteResponse.create resolves to `quote`. */
function txWith(create: jest.Mock) {
  return {
    quoteResponse: { create },
    quoteAudit: { create: jest.fn().mockResolvedValue({}) },
    accessToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
}

const vendorUser = {
  id: 'vendor-user-1',
  role: UserRole.VENDOR,
  companyId: 'vendor-co-1',
  email: 'vendor@test.com',
};

const contractorUser = {
  id: 'contractor-1',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'contractor-co-1',
  email: 'contractor@test.com',
};

const baseRfq = {
  id: 'rfq-1',
  companyId: 'contractor-co-1',
  status: 'OPEN',
  lineItems: [{ id: 'li-1' }, { id: 'li-2' }],
  invitedVendors: [{ vendorId: 'vendor-co-1' }],
};

const baseLineItemDto = {
  rfqLineItemId: 'li-1',
  unitPrice: 100,
  quotedQuantity: 10,
  deliveryDate: '2026-04-01',
};

const baseSubmitDto = {
  lineItems: [baseLineItemDto],
};

describe('QuoteResponseService', () => {
  let service: QuoteResponseService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QuoteResponseService(
      mockPrisma as never,
      mockAuditService as never,
      mockAccessTokens as never,
      mockStorage as never,
      mockDocIntelligence as never,
    );
    // Default: a valid QUOTE_SUBMIT token for RFQ rfq-1 / vendor vendor-co-1.
    mockAccessTokens.validateToken.mockResolvedValue({
      id: 'tok-1',
      subjectId: 'rfq-1',
      purpose: 'QUOTE_SUBMIT',
      subjectType: 'RFQ',
      metadata: { rfqVendorId: 'rv-1', vendorId: 'vendor-co-1' },
    });
    mockStorage.getSignedUrl.mockResolvedValue('https://signed.example/doc');
  });

  // ── submitQuote ───────────────────────────────────────────────────────────

  describe('submitQuote', () => {
    it('should create quote response with line items', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(baseRfq);
      mockPrisma.quoteResponse.findFirst.mockResolvedValue(null);

      const createdQuote = {
        id: 'quote-1',
        rfqId: 'rfq-1',
        vendorId: 'vendor-co-1',
        lineItems: [],
        vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
      };

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(txWith(jest.fn().mockResolvedValue(createdQuote)));
      });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.submitQuote('rfq-1', baseSubmitDto as never, vendorUser);

      expect(result.id).toBe('quote-1');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'QUOTE_SUBMITTED',
          targetType: 'QuoteResponse',
          targetId: 'quote-1',
        }),
      );
    });

    it('should throw if RFQ is CLOSED', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        ...baseRfq,
        status: 'CLOSED',
      });

      await expect(
        service.submitQuote('rfq-1', baseSubmitDto as never, vendorUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if vendor not invited', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        ...baseRfq,
        invitedVendors: [{ vendorId: 'other-vendor' }],
      });

      await expect(
        service.submitQuote('rfq-1', baseSubmitDto as never, vendorUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if quote already submitted', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(baseRfq);
      mockPrisma.quoteResponse.findFirst.mockResolvedValue({
        id: 'existing-quote',
        status: 'SUBMITTED',
      });

      await expect(
        service.submitQuote('rfq-1', baseSubmitDto as never, vendorUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark non-responded items as NO_QUOTE', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(baseRfq);
      mockPrisma.quoteResponse.findFirst.mockResolvedValue(null);

      // Submit only li-1, so li-2 should be NO_QUOTE
      const dto = { lineItems: [baseLineItemDto] };

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const create = jest.fn().mockImplementation(
          (args: {
            data: {
              lineItems: {
                createMany: { data: Array<{ rfqLineItemId: string; availability: string }> };
              };
            };
          }) => {
            const createdLineItems = args.data.lineItems.createMany.data;
            const noQuoteItem = createdLineItems.find((li) => li.rfqLineItemId === 'li-2');
            expect(noQuoteItem).toBeDefined();
            expect(noQuoteItem?.availability).toBe('NO_QUOTE');

            return {
              id: 'quote-1',
              rfqId: 'rfq-1',
              vendorId: 'vendor-co-1',
              lineItems: createdLineItems,
              vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
            };
          },
        );
        return fn(txWith(create));
      });
      mockAuditService.log.mockResolvedValue(undefined);

      await service.submitQuote('rfq-1', dto as never, vendorUser);
    });
  });

  // ── updateQuote ───────────────────────────────────────────────────────────

  describe('updateQuote', () => {
    const existingQuote = {
      id: 'quote-1',
      vendorId: 'vendor-co-1',
      source: 'FORM',
      totalCost: 1000,
      itemsCovered: 1,
      totalItems: 2,
      bulkDiscount: null,
      bulkTax: null,
      bulkShipment: null,
      lineItems: [
        { rfqLineItemId: 'li-1', unitPrice: 100, quotedQuantity: 10, lineTotal: 1000 },
      ],
      rfq: {
        ...baseRfq,
      },
    };

    it('should update existing quote line items', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue(existingQuote);

      const updatedQuote = {
        id: 'quote-1',
        rfqId: 'rfq-1',
        vendorId: 'vendor-co-1',
        lineItems: [],
        vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
      };

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          quoteResponseLineItem: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          quoteAttachment: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            createMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          quoteResponse: {
            update: jest.fn().mockResolvedValue(updatedQuote),
          },
          quoteAudit: { create: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.updateQuote(
        'rfq-1',
        'quote-1',
        baseSubmitDto as never,
        vendorUser,
      );

      expect(result.id).toBe('quote-1');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'QUOTE_UPDATED',
          targetType: 'QuoteResponse',
          targetId: 'quote-1',
        }),
      );
    });

    it('should record a QUOTE_UPDATED audit with a full edit diff (changed/added/removed)', async () => {
      // Before: li-1 @100 and a soon-to-be-removed li-old.
      mockPrisma.quoteResponse.findUnique.mockResolvedValue({
        ...existingQuote,
        lineItems: [
          { rfqLineItemId: 'li-1', unitPrice: 100, quotedQuantity: 10, lineTotal: 1000 },
          { rfqLineItemId: 'li-old', unitPrice: 5, quotedQuantity: 1, lineTotal: 5 },
        ],
      });

      // Vendor reprices li-1 and (mock) ends with a new li-2 line, attaching a file.
      const editedDto = {
        attachmentIds: ['11111111-1111-1111-1111-111111111111'],
        lineItems: [
          { rfqLineItemId: 'li-1', unitPrice: 120, quotedQuantity: 10, deliveryDate: '2026-04-01' },
        ],
      };
      const updatedQuote = {
        id: 'quote-1',
        rfqId: 'rfq-1',
        vendorId: 'vendor-co-1',
        itemsCovered: 1,
        totalItems: 2,
        totalCost: 1200,
        bulkDiscount: null,
        bulkTax: null,
        bulkShipment: null,
        lineItems: [
          { rfqLineItemId: 'li-1', unitPrice: 120, quotedQuantity: 10, lineTotal: 1200 },
          { rfqLineItemId: 'li-2', unitPrice: 60, quotedQuantity: 2, lineTotal: 120 },
        ],
        vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
      };

      const auditCreate = jest.fn().mockResolvedValue({});
      const attachmentCreateMany = jest.fn().mockResolvedValue({ count: 1 });
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          quoteResponseLineItem: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          quoteAttachment: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            createMany: attachmentCreateMany,
          },
          quoteResponse: { update: jest.fn().mockResolvedValue(updatedQuote) },
          quoteAudit: { create: auditCreate },
        });
      });
      mockAuditService.log.mockResolvedValue(undefined);

      await service.updateQuote('rfq-1', 'quote-1', editedDto as never, vendorUser);

      // Attachments were re-created from the dto.
      expect(attachmentCreateMany).toHaveBeenCalled();

      const auditArgs = auditCreate.mock.calls[0][0].data;
      expect(auditArgs.action).toBe('UPDATED');
      expect(auditArgs.changes.fields).toHaveProperty('totalCost', { from: 1000, to: 1200 });
      expect(auditArgs.changes.lineItems).toEqual({ changed: 1, added: 1, removed: 1 });
    });

    it('should throw if user does not own the quote', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue({
        ...existingQuote,
        vendorId: 'other-vendor-co',
      });

      await expect(
        service.updateQuote('rfq-1', 'quote-1', baseSubmitDto as never, vendorUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when RFQ is CLOSED', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue({
        ...existingQuote,
        rfq: { ...baseRfq, status: 'CLOSED' },
      });

      await expect(
        service.updateQuote('rfq-1', 'quote-1', baseSubmitDto as never, vendorUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when RFQ is CANCELLED', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue({
        ...existingQuote,
        rfq: { ...baseRfq, status: 'CANCELLED' },
      });

      await expect(
        service.updateQuote('rfq-1', 'quote-1', baseSubmitDto as never, vendorUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── getQuoteDetail ────────────────────────────────────────────────────────

  describe('getQuoteDetail', () => {
    it('should return quote with line items', async () => {
      const quote = {
        id: 'quote-1',
        rfqId: 'rfq-1',
        vendorId: 'vendor-co-1',
        lineItems: [
          {
            id: 'qli-1',
            rfqLineItem: { material: { id: 'mat-1', name: 'Steel', uom: 'KG' } },
          },
        ],
        attachments: [],
        vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
        rfq: { id: 'rfq-1', companyId: 'contractor-co-1', rfqNumber: 'RFQ-001' },
        warehouseLocation: null,
      };

      mockPrisma.quoteResponse.findUnique.mockResolvedValue(quote);

      // Test as the vendor who owns the quote
      const result = await service.getQuoteDetail('rfq-1', 'quote-1', vendorUser);

      expect(result.id).toBe('quote-1');
      expect(result.lineItems).toHaveLength(1);
    });

    it('should throw NotFoundException when quote not found', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue(null);

      await expect(service.getQuoteDetail('rfq-1', 'quote-999', vendorUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return quote when accessed by contractor of RFQ company', async () => {
      const quote = {
        id: 'quote-1',
        rfqId: 'rfq-1',
        vendorId: 'vendor-co-1',
        lineItems: [],
        attachments: [],
        vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
        rfq: { id: 'rfq-1', companyId: 'contractor-co-1', rfqNumber: 'RFQ-001' },
        warehouseLocation: null,
      };

      mockPrisma.quoteResponse.findUnique.mockResolvedValue(quote);

      const result = await service.getQuoteDetail('rfq-1', 'quote-1', contractorUser);

      expect(result.id).toBe('quote-1');
    });

    it('should throw ForbiddenException when user has no access', async () => {
      const quote = {
        id: 'quote-1',
        rfqId: 'rfq-1',
        vendorId: 'other-vendor-co',
        lineItems: [],
        vendor: { id: 'other-vendor-co', legalName: 'Other' },
        rfq: { id: 'rfq-1', companyId: 'other-company', rfqNumber: 'RFQ-001' },
        warehouseLocation: null,
      };

      mockPrisma.quoteResponse.findUnique.mockResolvedValue(quote);

      await expect(service.getQuoteDetail('rfq-1', 'quote-1', vendorUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── assertVendorRole (tested via submitQuote) ─────────────────────────────

  describe('assertVendorRole', () => {
    it('should throw ForbiddenException when user is not a VENDOR', async () => {
      const nonVendorUser = {
        id: 'admin-1',
        role: UserRole.COMPANY_ADMIN,
        companyId: 'company-1',
        email: 'admin@test.com',
      };

      await expect(
        service.submitQuote('rfq-1', baseSubmitDto as never, nonVendorUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when vendor user has no companyId', async () => {
      const vendorNoCompany = {
        id: 'vendor-no-co',
        role: UserRole.VENDOR,
        companyId: null,
        email: 'vendor-no-co@test.com',
      };

      await expect(
        service.submitQuote('rfq-1', baseSubmitDto as never, vendorNoCompany),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── calculateLineTotal (tested via submitQuote with discount scenarios) ───

  describe('calculateLineTotal', () => {
    beforeEach(() => {
      mockPrisma.rfq.findUnique.mockResolvedValue(baseRfq);
      mockPrisma.quoteResponse.findFirst.mockResolvedValue(null);
      mockAuditService.log.mockResolvedValue(undefined);
    });

    it('should apply PERCENT discount to line total', async () => {
      const dtoWithPercentDiscount = {
        lineItems: [
          {
            ...baseLineItemDto,
            discount: 10,
            discountType: 'PERCENT',
          },
        ],
      };

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          quoteResponse: {
            create: jest
              .fn()
              .mockImplementation(
                (args: { data: { lineItems: { createMany: { data: Array<{ lineTotal: number }> } } } }) => {
                  const submittedItem = args.data.lineItems.createMany.data[0];
                  // 10 * 100 = 1000, 10% discount => 900
                  expect(submittedItem.lineTotal).toBe(900);
                  return {
                    id: 'quote-1',
                    rfqId: 'rfq-1',
                    vendorId: 'vendor-co-1',
                    lineItems: args.data.lineItems.createMany.data,
                    vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
                  };
                },
              ),
          },
          quoteAudit: { create: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      await service.submitQuote('rfq-1', dtoWithPercentDiscount as never, vendorUser);
    });

    it('should apply AMOUNT discount to line total', async () => {
      const dtoWithAmountDiscount = {
        lineItems: [
          {
            ...baseLineItemDto,
            discount: 150,
            discountType: 'AMOUNT',
          },
        ],
      };

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          quoteResponse: {
            create: jest
              .fn()
              .mockImplementation(
                (args: { data: { lineItems: { createMany: { data: Array<{ lineTotal: number }> } } } }) => {
                  const submittedItem = args.data.lineItems.createMany.data[0];
                  // 10 * 100 = 1000, minus 150 => 850
                  expect(submittedItem.lineTotal).toBe(850);
                  return {
                    id: 'quote-1',
                    rfqId: 'rfq-1',
                    vendorId: 'vendor-co-1',
                    lineItems: args.data.lineItems.createMany.data,
                    vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
                  };
                },
              ),
          },
          quoteAudit: { create: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      await service.submitQuote('rfq-1', dtoWithAmountDiscount as never, vendorUser);
    });

    it('should return subtotal for unknown discount type', async () => {
      const dtoWithUnknownDiscount = {
        lineItems: [
          {
            ...baseLineItemDto,
            discount: 50,
            discountType: 'UNKNOWN_TYPE',
          },
        ],
      };

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          quoteResponse: {
            create: jest
              .fn()
              .mockImplementation(
                (args: { data: { lineItems: { createMany: { data: Array<{ lineTotal: number }> } } } }) => {
                  const submittedItem = args.data.lineItems.createMany.data[0];
                  // 10 * 100 = 1000, unknown type => no discount applied
                  expect(submittedItem.lineTotal).toBe(1000);
                  return {
                    id: 'quote-1',
                    rfqId: 'rfq-1',
                    vendorId: 'vendor-co-1',
                    lineItems: args.data.lineItems.createMany.data,
                    vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
                  };
                },
              ),
          },
          quoteAudit: { create: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      await service.submitQuote('rfq-1', dtoWithUnknownDiscount as never, vendorUser);
    });
  });

  // ── getGuestRfq ──────────────────────────────────────────────────────────

  describe('getGuestRfq', () => {
    const baseRfqVendor = {
      rfqId: 'rfq-1',
      rfq: {
        id: 'rfq-1',
        rfqNumber: 'RFQ-001',
        status: 'OPEN',
        needByDate: new Date('2026-05-01'),
        message: 'Please quote',
        company: { legalName: 'ContractorCo' },
        project: { name: 'Project Alpha' },
        deliveryLocation: { label: 'Warehouse A', address: '123 Main St' },
        documents: [],
        lineItems: [
          {
            id: 'li-1',
            material: { id: 'mat-1', name: 'Steel', uom: 'KG' },
            unit: 'KG',
            quantity: 100,
            description: 'Hot rolled steel',
            costCode: 'CC-01',
          },
        ],
      },
      vendor: { legalName: 'VendorCo' },
      vendorId: 'vendor-co-1',
    };

    it('should throw NotFoundException for invalid token', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(null);

      await expect(service.getGuestRfq('bad-token')).rejects.toThrow(NotFoundException);
    });

    it('should return RFQ with all fields populated', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(baseRfqVendor);

      const result = await service.getGuestRfq('valid-token');

      expect(result.id).toBe('rfq-1');
      expect(result.rfqNumber).toBe('RFQ-001');
      expect(result.contractorName).toBe('ContractorCo');
      expect(result.projectName).toBe('Project Alpha');
      expect(result.deliveryLocation).toBe('Warehouse A');
      expect(result.needByDate).toBe(new Date('2026-05-01').toISOString());
      expect(result.vendorName).toBe('VendorCo');
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].materialName).toBe('Steel');
    });

    it('should return null projectName when project is null', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue({
        ...baseRfqVendor,
        rfq: { ...baseRfqVendor.rfq, project: null },
      });

      const result = await service.getGuestRfq('valid-token');

      expect(result.projectName).toBeNull();
    });

    it('should fall back to address when deliveryLocation has no label', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue({
        ...baseRfqVendor,
        rfq: {
          ...baseRfqVendor.rfq,
          deliveryLocation: { label: null, address: '456 Elm St' },
        },
      });

      const result = await service.getGuestRfq('valid-token');

      expect(result.deliveryLocation).toBe('456 Elm St');
    });

    it('should return null deliveryLocation when location is null', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue({
        ...baseRfqVendor,
        rfq: { ...baseRfqVendor.rfq, deliveryLocation: null },
      });

      const result = await service.getGuestRfq('valid-token');

      expect(result.deliveryLocation).toBeNull();
    });

    it('should return null needByDate when needByDate is null', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue({
        ...baseRfqVendor,
        rfq: { ...baseRfqVendor.rfq, needByDate: null },
      });

      const result = await service.getGuestRfq('valid-token');

      expect(result.needByDate).toBeNull();
    });

    it('should use description as materialName when material is null', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue({
        ...baseRfqVendor,
        rfq: {
          ...baseRfqVendor.rfq,
          lineItems: [
            {
              id: 'li-1',
              material: null,
              unit: 'KG',
              quantity: 100,
              description: 'Custom item',
              costCode: 'CC-01',
            },
          ],
        },
      });

      const result = await service.getGuestRfq('valid-token');

      expect(result.lineItems[0].materialName).toBe('Custom item');
    });

    it('should return empty string materialName when both material and description are null', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue({
        ...baseRfqVendor,
        rfq: {
          ...baseRfqVendor.rfq,
          lineItems: [
            {
              id: 'li-1',
              material: null,
              unit: 'KG',
              quantity: 100,
              description: null,
              costCode: null,
            },
          ],
        },
      });

      const result = await service.getGuestRfq('valid-token');

      expect(result.lineItems[0].materialName).toBe('');
    });

    it('should map RFQ documents to downloadable signed URLs', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue({
        ...baseRfqVendor,
        rfq: {
          ...baseRfqVendor.rfq,
          documents: [
            {
              file: {
                id: 'file-1',
                key: 'rfq-documents/rfq-1/spec.pdf',
                filename: 'spec.pdf',
                mimeType: 'application/pdf',
                size: 2048,
              },
            },
          ],
        },
      });
      mockStorage.getSignedUrl.mockResolvedValue('https://signed.example/spec.pdf');

      const result = await service.getGuestRfq('valid-token');

      expect(mockStorage.getSignedUrl).toHaveBeenCalledWith('rfq-documents/rfq-1/spec.pdf');
      expect(result.attachments).toEqual([
        {
          id: 'file-1',
          filename: 'spec.pdf',
          mimeType: 'application/pdf',
          size: 2048,
          url: 'https://signed.example/spec.pdf',
        },
      ]);
    });

    it('should validate the token with QUOTE_SUBMIT purpose and RFQ subject', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(baseRfqVendor);

      await service.getGuestRfq('valid-token');

      expect(mockAccessTokens.validateToken).toHaveBeenCalledWith('valid-token', {
        expectedPurpose: 'QUOTE_SUBMIT',
        expectedSubjectType: 'RFQ',
      });
    });

    it('should propagate token validation failures (expired/used/invalid)', async () => {
      mockAccessTokens.validateToken.mockRejectedValue(new ForbiddenException('Token expired'));

      await expect(service.getGuestRfq('used-token')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── submitGuestQuote ─────────────────────────────────────────────────────

  describe('submitGuestQuote', () => {
    const guestRfqVendor = {
      rfqId: 'rfq-1',
      rfq: {
        id: 'rfq-1',
        status: 'OPEN',
        lineItems: [{ id: 'li-1' }, { id: 'li-2' }],
        company: { legalName: 'ContractorCo' },
        project: { name: 'Project Alpha' },
        deliveryLocation: { label: 'Warehouse A', address: '123 Main St' },
        documents: [],
      },
      vendor: { legalName: 'VendorCo' },
      vendorId: 'vendor-co-1',
    };

    const guestSubmitDto = {
      lineItems: [
        {
          rfqLineItemId: 'li-1',
          unitPrice: 100,
          quotedQuantity: 10,
          deliveryDate: '2026-04-01',
        },
      ],
    };

    it('should throw NotFoundException for invalid invitation token', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(null);

      await expect(service.submitGuestQuote('bad-token', guestSubmitDto as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when RFQ status is not open', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue({
        ...guestRfqVendor,
        rfq: { ...guestRfqVendor.rfq, status: 'CLOSED' },
      });

      await expect(
        service.submitGuestQuote('valid-token', guestSubmitDto as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when quote already submitted', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(guestRfqVendor);
      mockPrisma.quoteResponse.findFirst.mockResolvedValue({
        id: 'existing-quote',
        status: 'SUBMITTED',
      });

      await expect(
        service.submitGuestQuote('valid-token', guestSubmitDto as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create guest quote with line items and audit log', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(guestRfqVendor);
      mockPrisma.quoteResponse.findFirst.mockResolvedValue(null);
      mockAuditService.log.mockResolvedValue(undefined);

      const createdQuote = {
        id: 'guest-quote-1',
        rfqId: 'rfq-1',
        vendorId: 'vendor-co-1',
        lineItems: [],
        vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
      };

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(txWith(jest.fn().mockResolvedValue(createdQuote)));
      });

      const result = await service.submitGuestQuote('valid-token', guestSubmitDto as never);

      expect(result.id).toBe('guest-quote-1');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'QUOTE_SUBMITTED',
          targetType: 'QuoteResponse',
          targetId: 'guest-quote-1',
          metadata: expect.objectContaining({ guestAccess: true }),
        }),
      );
    });

    it('should mark non-submitted line items as NO_QUOTE', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(guestRfqVendor);
      mockPrisma.quoteResponse.findFirst.mockResolvedValue(null);
      mockAuditService.log.mockResolvedValue(undefined);

      // Submit only li-1, so li-2 should become NO_QUOTE
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const create = jest.fn().mockImplementation(
          (args: {
            data: {
              lineItems: {
                createMany: {
                  data: Array<{ rfqLineItemId: string; availability: string }>;
                };
              };
            };
          }) => {
            const allItems = args.data.lineItems.createMany.data;
            const noQuoteItem = allItems.find((li) => li.rfqLineItemId === 'li-2');
            expect(noQuoteItem).toBeDefined();
            expect(noQuoteItem?.availability).toBe('NO_QUOTE');

            return {
              id: 'guest-quote-1',
              rfqId: 'rfq-1',
              vendorId: 'vendor-co-1',
              lineItems: allItems,
              vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
            };
          },
        );
        return fn(txWith(create));
      });

      await service.submitGuestQuote('valid-token', guestSubmitDto as never);
    });

    it('should handle optional dto fields (bulkShipment, bulkDeliveryTime, etc.)', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(guestRfqVendor);
      mockPrisma.quoteResponse.findFirst.mockResolvedValue(null);
      mockAuditService.log.mockResolvedValue(undefined);

      const fullDto = {
        lineItems: [
          {
            rfqLineItemId: 'li-1',
            unitPrice: 50,
            quotedQuantity: 20,
            deliveryDate: '2026-04-01',
            availability: 'AVAILABLE',
            substituteItemId: 'sub-1',
            discount: 10,
            discountType: 'PERCENT',
            tax: 5,
            taxIncluded: true,
            backOrderQty: 5,
            backOrderDeliveryDate: '2026-05-01',
            notes: 'Test note',
          },
        ],
        bulkShipment: 200,
        bulkDeliveryTime: '2026-06-01',
        bulkDiscount: 5,
        bulkTax: 8,
        warehouseLocationId: 'wh-1',
        validityPeriod: '2026-07-01',
        message: 'Guest message',
      };

      const createdQuote = {
        id: 'guest-quote-2',
        rfqId: 'rfq-1',
        vendorId: 'vendor-co-1',
        lineItems: [],
        vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
      };

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(txWith(jest.fn().mockResolvedValue(createdQuote)));
      });

      const result = await service.submitGuestQuote('valid-token', fullDto as never);

      expect(result.id).toBe('guest-quote-2');
    });

    it('should handle dto with no optional bulk fields (null branches)', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(guestRfqVendor);
      mockPrisma.quoteResponse.findFirst.mockResolvedValue(null);
      mockAuditService.log.mockResolvedValue(undefined);

      const minimalDto = {
        lineItems: [
          {
            rfqLineItemId: 'li-1',
            unitPrice: 100,
            quotedQuantity: 10,
            deliveryDate: '2026-04-01',
            // no availability, no substituteItemId, no discount, no tax, no backOrder, no notes
          },
        ],
        // no bulkShipment, no bulkDeliveryTime, no bulkDiscount, no bulkTax, no warehouseLocationId, no validityPeriod, no message
      };

      const createdQuote = {
        id: 'guest-quote-3',
        rfqId: 'rfq-1',
        vendorId: 'vendor-co-1',
        lineItems: [],
        vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
      };

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(txWith(jest.fn().mockResolvedValue(createdQuote)));
      });

      const result = await service.submitGuestQuote('valid-token', minimalDto as never);

      expect(result.id).toBe('guest-quote-3');
    });

    it('should throw BadRequestException when RFQ status is CANCELLED', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue({
        ...guestRfqVendor,
        rfq: { ...guestRfqVendor.rfq, status: 'CANCELLED' },
      });

      await expect(
        service.submitGuestQuote('valid-token', guestSubmitDto as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('should filter NO_QUOTE items from itemsCovered count', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(guestRfqVendor);
      mockPrisma.quoteResponse.findFirst.mockResolvedValue(null);
      mockAuditService.log.mockResolvedValue(undefined);

      const dtoWithNoQuoteItem = {
        lineItems: [
          {
            rfqLineItemId: 'li-1',
            unitPrice: 100,
            quotedQuantity: 10,
            deliveryDate: '2026-04-01',
            availability: 'NO_QUOTE',
          },
          {
            rfqLineItemId: 'li-2',
            unitPrice: 200,
            quotedQuantity: 5,
            deliveryDate: '2026-04-01',
            availability: 'AVAILABLE',
          },
        ],
      };

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const create = jest.fn().mockImplementation((args: { data: { itemsCovered: number } }) => {
          // Only li-2 is AVAILABLE, so itemsCovered should be 1
          expect(args.data.itemsCovered).toBe(1);
          return {
            id: 'guest-quote-4',
            rfqId: 'rfq-1',
            vendorId: 'vendor-co-1',
            lineItems: [],
            vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
          };
        });
        return fn(txWith(create));
      });

      await service.submitGuestQuote('valid-token', dtoWithNoQuoteItem as never);
    });

    it('should burn the token and persist paymentTerms', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(guestRfqVendor);
      mockPrisma.quoteResponse.findFirst.mockResolvedValue(null);
      mockAuditService.log.mockResolvedValue(undefined);

      const create = jest.fn().mockImplementation((args: { data: { paymentTerms: string } }) => {
        expect(args.data.paymentTerms).toBe('Net 30');
        return {
          id: 'guest-quote-5',
          rfqId: 'rfq-1',
          vendorId: 'vendor-co-1',
          lineItems: [],
          vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
        };
      });
      const burnMock = jest.fn().mockResolvedValue({ count: 1 });

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          quoteResponse: { create },
          quoteAudit: { create: jest.fn().mockResolvedValue({}) },
          accessToken: { updateMany: burnMock },
        });
      });

      const result = await service.submitGuestQuote('valid-token', {
        ...guestSubmitDto,
        paymentTerms: 'Net 30',
      } as never);

      expect(result.id).toBe('guest-quote-5');
      expect(burnMock).toHaveBeenCalledWith({
        where: { id: 'tok-1', usedAt: null, revokedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('should throw ForbiddenException when the token is consumed concurrently', async () => {
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(guestRfqVendor);
      mockPrisma.quoteResponse.findFirst.mockResolvedValue(null);

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          quoteResponse: {
            create: jest.fn().mockResolvedValue({
              id: 'guest-quote-6',
              lineItems: [],
              vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
            }),
          },
          quoteAudit: { create: jest.fn().mockResolvedValue({}) },
          accessToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        });
      });

      await expect(
        service.submitGuestQuote('valid-token', guestSubmitDto as never),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── Quote audit trail (FOR-207) ──────────────────────────────────────────

  describe('quote audit recording', () => {
    it('records a SUBMITTED audit with source FORM and persists attachments', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(baseRfq);
      mockPrisma.quoteResponse.findFirst.mockResolvedValue(null);
      mockAuditService.log.mockResolvedValue(undefined);

      const auditCreate = jest.fn().mockResolvedValue({});
      const create = jest.fn().mockImplementation(
        (args: { data: { attachments?: { create: Array<{ fileId: string }> } } }) => {
          // The attachmentIds from the dto are attached on create (line coverage).
          expect(args.data.attachments?.create).toEqual([{ fileId: 'file-1' }]);
          return {
            id: 'quote-1',
            rfqId: 'rfq-1',
            vendorId: 'vendor-co-1',
            lineItems: [],
            vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
          };
        },
      );
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          quoteResponse: { create },
          quoteAudit: { create: auditCreate },
          accessToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        });
      });

      await service.submitQuote(
        'rfq-1',
        { ...baseSubmitDto, attachmentIds: ['file-1'] } as never,
        vendorUser,
      );

      const data = auditCreate.mock.calls[0][0].data;
      expect(data.action).toBe('SUBMITTED');
      expect(data.source).toBe('FORM');
      expect(data.performedById).toBe('vendor-user-1');
    });

    it('records source PDF and a guest vendor label on a PDF guest submit', async () => {
      const guestRfqVendor = {
        rfqId: 'rfq-1',
        rfq: {
          id: 'rfq-1',
          status: 'OPEN',
          lineItems: [{ id: 'li-1' }, { id: 'li-2' }],
          createdByUserId: 'creator-1',
        },
        vendor: { legalName: 'VendorCo' },
        vendorId: 'vendor-co-1',
      };
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(guestRfqVendor);
      mockPrisma.quoteResponse.findFirst.mockResolvedValue(null);
      mockAuditService.log.mockResolvedValue(undefined);

      const auditCreate = jest.fn().mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          quoteResponse: {
            create: jest.fn().mockResolvedValue({
              id: 'guest-quote-pdf',
              rfqId: 'rfq-1',
              vendorId: 'vendor-co-1',
              lineItems: [],
              vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
            }),
          },
          quoteAudit: { create: auditCreate },
          accessToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        });
      });

      await service.submitGuestQuote('valid-token', {
        ...baseSubmitDto,
        source: 'PDF',
      } as never);

      const data = auditCreate.mock.calls[0][0].data;
      expect(data.action).toBe('SUBMITTED');
      expect(data.source).toBe('PDF');
      expect(data.performedById).toBeNull();
      expect(data.performedByLabel).toBe('VendorCo');
    });
  });

  // ── getQuoteAudit ─────────────────────────────────────────────────────────

  describe('getQuoteAudit', () => {
    const auditRows = [
      {
        id: 'audit-1',
        quoteResponseId: 'quote-1',
        action: 'SUBMITTED',
        source: 'FORM',
        vendorId: 'vendor-co-1',
        performedByLabel: null,
        performedBy: { id: 'vendor-user-1', name: 'Vendor User' },
        quoteResponse: { id: 'quote-1', vendor: { id: 'vendor-co-1', legalName: 'VendorCo' } },
        changes: { snapshot: { totalCost: 1000 } },
        createdAt: new Date('2026-06-01T10:00:00Z'),
      },
    ];

    it('returns the full trail for a contractor of the RFQ company', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({ id: 'rfq-1', companyId: 'contractor-co-1' });
      mockPrisma.quoteAudit.findMany.mockResolvedValue(auditRows);

      const result = await service.getQuoteAudit('rfq-1', contractorUser);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'audit-1',
        action: 'SUBMITTED',
        source: 'FORM',
        vendorName: 'VendorCo',
        performedByName: 'Vendor User',
      });
      // Contractor sees every vendor's entries (no vendor scoping).
      expect(mockPrisma.quoteAudit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { rfqId: 'rfq-1' } }),
      );
    });

    it('scopes a vendor to their own company entries', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({ id: 'rfq-1', companyId: 'contractor-co-1' });
      mockPrisma.quoteAudit.findMany.mockResolvedValue([]);

      await service.getQuoteAudit('rfq-1', vendorUser);

      expect(mockPrisma.quoteAudit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { rfqId: 'rfq-1', vendorId: 'vendor-co-1' } }),
      );
    });

    it('falls back to the vendor label when there is no performer account', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({ id: 'rfq-1', companyId: 'contractor-co-1' });
      mockPrisma.quoteAudit.findMany.mockResolvedValue([
        { ...auditRows[0], performedBy: null, performedByLabel: 'Guest VendorCo' },
      ]);

      const result = await service.getQuoteAudit('rfq-1', contractorUser);

      expect(result[0].performedByName).toBe('Guest VendorCo');
    });

    it('falls back to the vendor legal name when performer and label are both absent', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({ id: 'rfq-1', companyId: 'contractor-co-1' });
      mockPrisma.quoteAudit.findMany.mockResolvedValue([
        { ...auditRows[0], performedBy: null, performedByLabel: null },
      ]);

      const result = await service.getQuoteAudit('rfq-1', contractorUser);

      expect(result[0].performedByName).toBe('VendorCo');
    });

    it('throws NotFoundException when the RFQ does not exist', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(null);

      await expect(service.getQuoteAudit('rfq-x', contractorUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for an unrelated company admin', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({ id: 'rfq-1', companyId: 'other-company' });

      await expect(service.getQuoteAudit('rfq-1', contractorUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── getQuoteComparison (FOR-208) ──────────────────────────────────────────────

  describe('getQuoteComparison', () => {
    const comparisonRfq = {
      id: 'rfq-1',
      companyId: 'contractor-co-1',
      currency: 'AUD',
      lineItems: [{ id: 'li-1', materialName: 'Cement', quantity: 10, unit: 'bags' }],
    };

    const quoteRows = [
      {
        id: 'quote-1',
        vendorId: 'vendor-co-1',
        status: 'SUBMITTED',
        submittedAt: new Date('2026-06-01T00:00:00Z'),
        paymentTerms: 'Net 30',
        bulkDeliveryTime: null,
        vendor: { legalName: 'VendorCo' },
        lineItems: [
          {
            rfqLineItemId: 'li-1',
            unitPrice: { toString: () => '12.5' },
            quotedQuantity: 10,
            availability: 'AVAILABLE',
            deliveryDate: new Date('2026-07-01T00:00:00Z'),
          },
        ],
      },
    ];

    it('aggregates received quotes into a comparison grid for the contractor', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(comparisonRfq);
      mockPrisma.quoteResponse.findMany.mockResolvedValue(quoteRows);

      const result = await service.getQuoteComparison('rfq-1', contractorUser);

      expect(result.rfqId).toBe('rfq-1');
      expect(result.currency).toBe('AUD');
      expect(result.vendors).toHaveLength(1);
      expect(result.vendors[0]).toMatchObject({
        vendorName: 'VendorCo',
        paymentTerms: 'Net 30',
        total: 125,
        itemsCovered: 1,
        totalItems: 1,
      });
      expect(result.rows[0].cells[0]).toMatchObject({ extendedCost: 125, isLowest: true });
      // Only SUBMITTED/APPROVED quotes feed the comparison.
      expect(mockPrisma.quoteResponse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { rfqId: 'rfq-1', status: { in: ['SUBMITTED', 'APPROVED'] } },
        }),
      );
    });

    it('throws NotFoundException when the RFQ does not exist', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(null);

      await expect(service.getQuoteComparison('rfq-x', contractorUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for an unrelated company admin', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({ ...comparisonRfq, companyId: 'other-company' });

      await expect(service.getQuoteComparison('rfq-1', contractorUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('denies a vendor — comparison is contractor-only', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(comparisonRfq);

      await expect(service.getQuoteComparison('rfq-1', vendorUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
