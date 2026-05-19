import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { QuoteResponseService } from '../quote-response.service';

const mockPrisma = {
  rfq: { findUnique: jest.fn() },
  rfqVendor: { findUnique: jest.fn() },
  quoteResponse: { findFirst: jest.fn(), findUnique: jest.fn() },
  $transaction: jest.fn(),
};

const mockAuditService = {
  log: jest.fn(),
};

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
    service = new QuoteResponseService(mockPrisma as never, mockAuditService as never);
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
        const tx = {
          quoteResponse: {
            create: jest.fn().mockResolvedValue(createdQuote),
          },
        };
        return fn(tx);
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
        const tx = {
          quoteResponse: {
            create: jest.fn().mockImplementation(
              (args: {
                data: {
                  lineItems: { create: Array<{ rfqLineItemId: string; availability: string }> };
                };
              }) => {
                const createdLineItems = args.data.lineItems.create;
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
            ),
          },
        };
        return fn(tx);
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
                (args: { data: { lineItems: { create: Array<{ lineTotal: number }> } } }) => {
                  const submittedItem = args.data.lineItems.create[0];
                  // 10 * 100 = 1000, 10% discount => 900
                  expect(submittedItem.lineTotal).toBe(900);
                  return {
                    id: 'quote-1',
                    rfqId: 'rfq-1',
                    vendorId: 'vendor-co-1',
                    lineItems: args.data.lineItems.create,
                    vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
                  };
                },
              ),
          },
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
                (args: { data: { lineItems: { create: Array<{ lineTotal: number }> } } }) => {
                  const submittedItem = args.data.lineItems.create[0];
                  // 10 * 100 = 1000, minus 150 => 850
                  expect(submittedItem.lineTotal).toBe(850);
                  return {
                    id: 'quote-1',
                    rfqId: 'rfq-1',
                    vendorId: 'vendor-co-1',
                    lineItems: args.data.lineItems.create,
                    vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
                  };
                },
              ),
          },
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
                (args: { data: { lineItems: { create: Array<{ lineTotal: number }> } } }) => {
                  const submittedItem = args.data.lineItems.create[0];
                  // 10 * 100 = 1000, unknown type => no discount applied
                  expect(submittedItem.lineTotal).toBe(1000);
                  return {
                    id: 'quote-1',
                    rfqId: 'rfq-1',
                    vendorId: 'vendor-co-1',
                    lineItems: args.data.lineItems.create,
                    vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
                  };
                },
              ),
          },
        };
        return fn(tx);
      });

      await service.submitQuote('rfq-1', dtoWithUnknownDiscount as never, vendorUser);
    });
  });

  // ── getGuestRfq ──────────────────────────────────────────────────────────

  describe('getGuestRfq', () => {
    const baseRfqVendor = {
      rfq: {
        id: 'rfq-1',
        rfqNumber: 'RFQ-001',
        status: 'OPEN',
        needByDate: new Date('2026-05-01'),
        message: 'Please quote',
        company: { legalName: 'ContractorCo' },
        project: { name: 'Project Alpha' },
        deliveryLocation: { label: 'Warehouse A', address: '123 Main St' },
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
  });

  // ── submitGuestQuote ─────────────────────────────────────────────────────

  describe('submitGuestQuote', () => {
    const guestRfqVendor = {
      rfq: {
        id: 'rfq-1',
        status: 'OPEN',
        lineItems: [{ id: 'li-1' }, { id: 'li-2' }],
        company: { legalName: 'ContractorCo' },
        project: { name: 'Project Alpha' },
        deliveryLocation: { label: 'Warehouse A', address: '123 Main St' },
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
        const tx = {
          quoteResponse: {
            create: jest.fn().mockResolvedValue(createdQuote),
          },
        };
        return fn(tx);
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
        const tx = {
          quoteResponse: {
            create: jest.fn().mockImplementation(
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
            ),
          },
        };
        return fn(tx);
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
        const tx = {
          quoteResponse: {
            create: jest.fn().mockResolvedValue(createdQuote),
          },
        };
        return fn(tx);
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
        const tx = {
          quoteResponse: {
            create: jest.fn().mockResolvedValue(createdQuote),
          },
        };
        return fn(tx);
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
        const tx = {
          quoteResponse: {
            create: jest.fn().mockImplementation((args: { data: { itemsCovered: number } }) => {
              // Only li-2 is AVAILABLE, so itemsCovered should be 1
              expect(args.data.itemsCovered).toBe(1);
              return {
                id: 'guest-quote-4',
                rfqId: 'rfq-1',
                vendorId: 'vendor-co-1',
                lineItems: [],
                vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
              };
            }),
          },
        };
        return fn(tx);
      });

      await service.submitGuestQuote('valid-token', dtoWithNoQuoteItem as never);
    });
  });
});
