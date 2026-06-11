import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';

import { QuoteResponseService } from '../quote-response.service';
import { RfqAvailabilityService } from '../rfq-availability.service';
import { RfqExportService } from '../rfq-export.service';
import { RfqsController } from '../rfqs.controller';
import { RfqsService } from '../rfqs.service';

const mockRfqsService = {
  listRfqs: jest.fn(),
  getRfq: jest.fn(),
  saveRfqDraft: jest.fn(),
  copyRfq: jest.fn(),
  archiveRfq: jest.fn(),
  approveQuote: jest.fn(),
  awardQuote: jest.fn(),
  declineQuote: jest.fn(),
  updateLineItem: jest.fn(),
  deleteLineItem: jest.fn(),
  uploadDocument: jest.fn(),
  deleteDocument: jest.fn(),
  notifyContractorOfQuoteUpdate: jest.fn(),
  notifyContractorOfQuoteSubmission: jest.fn(),
};

const mockRfqExportService = {
  exportRfqs: jest.fn(),
};

const mockRfqAvailabilityService = {
  checkAvailability: jest.fn(),
  confirmCoverage: jest.fn(),
};

const mockQuoteResponseService = {
  submitQuote: jest.fn(),
  updateQuote: jest.fn(),
  getQuoteDetail: jest.fn(),
  getQuoteAudit: jest.fn(),
  getQuoteComparison: jest.fn(),
  getGuestRfq: jest.fn(),
  submitGuestQuote: jest.fn(),
};

const mockUser = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};

describe('RfqsController', () => {
  let controller: RfqsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RfqsController],
      providers: [
        { provide: RfqsService, useValue: mockRfqsService },
        { provide: RfqExportService, useValue: mockRfqExportService },
        { provide: QuoteResponseService, useValue: mockQuoteResponseService },
        { provide: RfqAvailabilityService, useValue: mockRfqAvailabilityService },
      ],
    }).compile();

    controller = module.get<RfqsController>(RfqsController);
  });

  describe('listRfqs', () => {
    it('delegates to service with query and user', async () => {
      const query = { page: 1, limit: 25 };
      const expected = { items: [], meta: { page: 1, limit: 25, total: 0, totalPages: 0 } };
      mockRfqsService.listRfqs.mockResolvedValue(expected);

      const result = await controller.listRfqs(query as never, mockUser);
      expect(mockRfqsService.listRfqs).toHaveBeenCalledWith(query, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('getRfq', () => {
    it('delegates to service with id and user', async () => {
      const expected = { id: 'rfq-1', projectName: 'Alpha' };
      mockRfqsService.getRfq.mockResolvedValue(expected);

      const result = await controller.getRfq('rfq-1', mockUser);
      expect(mockRfqsService.getRfq).toHaveBeenCalledWith('rfq-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('saveRfqDraft', () => {
    it('delegates to service with dto and user', async () => {
      const dto = { projectId: 'proj-1' };
      const expected = { id: 'rfq-draft', status: 'DRAFT' };
      mockRfqsService.saveRfqDraft.mockResolvedValue(expected);

      const result = await controller.saveRfqDraft(dto as never, mockUser);
      expect(mockRfqsService.saveRfqDraft).toHaveBeenCalledWith(dto, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('exportRfqs', () => {
    it('delegates to export service', async () => {
      const expected = { url: 'https://example.com/export.csv' };
      mockRfqExportService.exportRfqs.mockResolvedValue(expected);
      const query = { page: 1, limit: 25 };

      const result = await controller.exportRfqs('csv', query as never, mockUser);
      expect(mockRfqExportService.exportRfqs).toHaveBeenCalledWith('csv', query, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('copyRfq', () => {
    it('delegates to service', async () => {
      const expected = { id: 'rfq-2' };
      mockRfqsService.copyRfq.mockResolvedValue(expected);

      const result = await controller.copyRfq('rfq-1', mockUser);
      expect(mockRfqsService.copyRfq).toHaveBeenCalledWith('rfq-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('archiveRfq', () => {
    it('delegates to service', async () => {
      const expected = { id: 'rfq-1', archived: true };
      mockRfqsService.archiveRfq.mockResolvedValue(expected);

      const result = await controller.archiveRfq('rfq-1', mockUser);
      expect(mockRfqsService.archiveRfq).toHaveBeenCalledWith('rfq-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('approveQuote', () => {
    it('delegates to service', async () => {
      const expected = { approved: true };
      mockRfqsService.approveQuote.mockResolvedValue(expected);

      const result = await controller.approveQuote('rfq-1', 'q-1', mockUser);
      expect(mockRfqsService.approveQuote).toHaveBeenCalledWith('rfq-1', 'q-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('awardQuote', () => {
    it('delegates to service and returns the created PO reference', async () => {
      const expected = {
        id: 'q-1',
        vendorName: 'VendorCo',
        status: 'APPROVED',
        totalCost: 15000,
        purchaseOrderId: 'po-1',
        poNumber: 'PO-00001',
      };
      mockRfqsService.awardQuote.mockResolvedValue(expected);

      const result = await controller.awardQuote('rfq-1', 'q-1', mockUser);
      expect(mockRfqsService.awardQuote).toHaveBeenCalledWith('rfq-1', 'q-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('declineQuote', () => {
    it('delegates to service', async () => {
      const expected = { declined: true };
      mockRfqsService.declineQuote.mockResolvedValue(expected);

      const result = await controller.declineQuote('rfq-1', 'q-1', mockUser);
      expect(mockRfqsService.declineQuote).toHaveBeenCalledWith('rfq-1', 'q-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('updateLineItem', () => {
    it('delegates to service', async () => {
      const dto = { description: 'Updated' };
      const expected = { id: 'li-1' };
      mockRfqsService.updateLineItem.mockResolvedValue(expected);

      const result = await controller.updateLineItem('rfq-1', 'li-1', dto as never, mockUser);
      expect(mockRfqsService.updateLineItem).toHaveBeenCalledWith('rfq-1', 'li-1', dto, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('deleteLineItem', () => {
    it('delegates to service', async () => {
      const expected = { deleted: true };
      mockRfqsService.deleteLineItem.mockResolvedValue(expected);

      const result = await controller.deleteLineItem('rfq-1', 'li-1', mockUser);
      expect(mockRfqsService.deleteLineItem).toHaveBeenCalledWith('rfq-1', 'li-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('uploadDocument', () => {
    it('delegates to service', async () => {
      const file = { originalname: 'doc.pdf' } as Express.Multer.File;
      const expected = { id: 'doc-1' };
      mockRfqsService.uploadDocument.mockResolvedValue(expected);

      const result = await controller.uploadDocument('rfq-1', file, mockUser);
      expect(mockRfqsService.uploadDocument).toHaveBeenCalledWith('rfq-1', file, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('deleteDocument', () => {
    it('delegates to service', async () => {
      const expected = { deleted: true };
      mockRfqsService.deleteDocument.mockResolvedValue(expected);

      const result = await controller.deleteDocument('rfq-1', 'doc-1', mockUser);
      expect(mockRfqsService.deleteDocument).toHaveBeenCalledWith('rfq-1', 'doc-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('submitQuote', () => {
    it('delegates to quote response service and notifies contractor', async () => {
      const dto = { lineItems: [] };
      mockQuoteResponseService.submitQuote.mockResolvedValue({
        id: 'q-1',
        vendor: { legalName: 'VendorCo' },
      });
      mockRfqsService.notifyContractorOfQuoteSubmission.mockResolvedValue(undefined);

      const result = await controller.submitQuote('rfq-1', dto as never, mockUser);
      expect(mockQuoteResponseService.submitQuote).toHaveBeenCalledWith('rfq-1', dto, mockUser);
      expect(result.vendor.legalName).toBe('VendorCo');
    });
  });

  describe('updateQuote', () => {
    it('delegates to quote response service and notifies contractor', async () => {
      const dto = { lineItems: [] };
      mockQuoteResponseService.updateQuote.mockResolvedValue({
        id: 'q-1',
        vendor: { legalName: 'VendorCo' },
      });
      mockRfqsService.notifyContractorOfQuoteUpdate.mockResolvedValue(undefined);

      const result = await controller.updateQuote('rfq-1', 'q-1', dto as never, mockUser);
      expect(mockQuoteResponseService.updateQuote).toHaveBeenCalledWith(
        'rfq-1',
        'q-1',
        dto,
        mockUser,
      );
      expect(result.vendor.legalName).toBe('VendorCo');
    });

    it('uses fallback vendor name when vendor is null', async () => {
      const dto = { lineItems: [] };
      mockQuoteResponseService.updateQuote.mockResolvedValue({ id: 'q-1', vendor: null });
      mockRfqsService.notifyContractorOfQuoteUpdate.mockResolvedValue(undefined);

      await controller.updateQuote('rfq-1', 'q-1', dto as never, mockUser);
      expect(mockRfqsService.notifyContractorOfQuoteUpdate).toHaveBeenCalledWith(
        'rfq-1',
        'A vendor',
      );
    });
  });

  describe('getQuoteDetail', () => {
    it('delegates to quote response service', async () => {
      mockQuoteResponseService.getQuoteDetail.mockResolvedValue({ id: 'q-1' });

      const result = await controller.getQuoteDetail('rfq-1', 'q-1', mockUser);
      expect(mockQuoteResponseService.getQuoteDetail).toHaveBeenCalledWith(
        'rfq-1',
        'q-1',
        mockUser,
      );
      expect(result).toEqual({ id: 'q-1' });
    });
  });

  describe('getQuoteAudit', () => {
    it('delegates to quote response service', async () => {
      const trail = [{ id: 'audit-1', action: 'SUBMITTED' }];
      mockQuoteResponseService.getQuoteAudit.mockResolvedValue(trail);

      const result = await controller.getQuoteAudit('rfq-1', mockUser);

      expect(mockQuoteResponseService.getQuoteAudit).toHaveBeenCalledWith('rfq-1', mockUser);
      expect(result).toEqual(trail);
    });
  });

  describe('getQuoteComparison', () => {
    it('delegates to quote response service', async () => {
      const comparison = { rfqId: 'rfq-1', currency: 'AUD', vendors: [], rows: [] };
      mockQuoteResponseService.getQuoteComparison.mockResolvedValue(comparison);

      const result = await controller.getQuoteComparison('rfq-1', mockUser);

      expect(mockQuoteResponseService.getQuoteComparison).toHaveBeenCalledWith('rfq-1', mockUser);
      expect(result).toEqual(comparison);
    });
  });

  describe('getGuestRfq', () => {
    it('delegates to quote response service', async () => {
      mockQuoteResponseService.getGuestRfq.mockResolvedValue({ id: 'rfq-1' });

      const result = await controller.getGuestRfq('token-123');
      expect(mockQuoteResponseService.getGuestRfq).toHaveBeenCalledWith('token-123');
      expect(result).toEqual({ id: 'rfq-1' });
    });
  });

  describe('submitGuestQuote', () => {
    it('delegates to quote response service', async () => {
      const dto = { lineItems: [] };
      mockQuoteResponseService.submitGuestQuote.mockResolvedValue({ id: 'q-1' });

      const result = await controller.submitGuestQuote('token-123', dto as never);
      expect(mockQuoteResponseService.submitGuestQuote).toHaveBeenCalledWith('token-123', dto);
      expect(result).toEqual({ id: 'q-1' });
    });
  });
});
