import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';

import { ApprovalsService } from '../../approvals/approvals.service';
import { InvoiceExportService } from '../invoice-export.service';
import { InvoiceIntakeService } from '../invoice-intake.service';
import { InvoiceMatchingService } from '../invoice-matching.service';
import { InvoicesController } from '../invoices.controller';
import { InvoicesService } from '../invoices.service';

const mockService = {
  listInvoices: jest.fn(),
  getInvoice: jest.fn(),
  getAuditTrail: jest.fn(),
  reviewInvoice: jest.fn(),
  approveInvoice: jest.fn(),
  rejectInvoice: jest.fn(),
  bulkApproveInvoices: jest.fn(),
  uploadDocument: jest.fn(),
  deleteDocument: jest.fn(),
};

const mockExportService = {
  exportInvoices: jest.fn(),
  exportSingleInvoice: jest.fn(),
};

const mockIntakeService = {
  uploadInvoice: jest.fn(),
  getIntakeAddress: jest.fn(),
};

const mockMatchingService = {
  getPoMatch: jest.fn(),
  getPoInfo: jest.fn(),
  exportRelatedPoPdf: jest.fn(),
};

/** Approver Pool read model + withdrawal (FOR-309); the controller delegates. */
const mockApprovalsService = {
  getApproverPool: jest.fn(),
  withdrawNomination: jest.fn(),
};

const mockUser = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};

describe('InvoicesController', () => {
  let controller: InvoicesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [
        { provide: InvoicesService, useValue: mockService },
        { provide: InvoiceExportService, useValue: mockExportService },
        { provide: InvoiceIntakeService, useValue: mockIntakeService },
        { provide: InvoiceMatchingService, useValue: mockMatchingService },
        { provide: ApprovalsService, useValue: mockApprovalsService },
      ],
    }).compile();

    controller = module.get<InvoicesController>(InvoicesController);
  });

  describe('listInvoices', () => {
    it('delegates to service', async () => {
      const expected = { items: [], meta: { page: 1, limit: 25, total: 0, totalPages: 0 } };
      mockService.listInvoices.mockResolvedValue(expected);

      const result = await controller.listInvoices({} as never, mockUser);
      expect(mockService.listInvoices).toHaveBeenCalledWith({}, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('getInvoice', () => {
    it('delegates to service', async () => {
      const expected = { id: 'inv-1' };
      mockService.getInvoice.mockResolvedValue(expected);

      const result = await controller.getInvoice('inv-1', mockUser);
      expect(mockService.getInvoice).toHaveBeenCalledWith('inv-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('getPoMatch', () => {
    it('delegates to the matching service', async () => {
      const expected = { resolution: 'AUTO_MATCHED', lines: [] };
      mockMatchingService.getPoMatch.mockResolvedValue(expected);

      const result = await controller.getPoMatch('inv-1', mockUser);
      expect(mockMatchingService.getPoMatch).toHaveBeenCalledWith('inv-1', mockUser, undefined);
      expect(result).toEqual(expected);
    });

    it("passes the reviewer's selected PO through as the reconciliation target", async () => {
      mockMatchingService.getPoMatch.mockResolvedValue({ resolution: 'SELECTED', lines: [] });

      await controller.getPoMatch('inv-1', mockUser, 'po-9');
      expect(mockMatchingService.getPoMatch).toHaveBeenCalledWith('inv-1', mockUser, 'po-9');
    });

    it('treats an empty poId as no selection', async () => {
      mockMatchingService.getPoMatch.mockResolvedValue({ resolution: 'NO_REFERENCE', lines: [] });

      await controller.getPoMatch('inv-1', mockUser, '');
      expect(mockMatchingService.getPoMatch).toHaveBeenCalledWith('inv-1', mockUser, undefined);
    });
  });

  describe('previewPoMatch (draft-lines preview)', () => {
    const lines = [{ description: 'DN100 PVC pipe', quantity: 10, unitPrice: 8.5 }];

    it('passes the picked PO and the draft lines through to the matching service', async () => {
      const expected = { resolution: 'SELECTED', lines: [] };
      mockMatchingService.getPoMatch.mockResolvedValue(expected);

      const result = await controller.previewPoMatch('inv-1', { poId: 'po-9', lines }, mockUser);
      expect(mockMatchingService.getPoMatch).toHaveBeenCalledWith('inv-1', mockUser, 'po-9', lines);
      expect(result).toEqual(expected);
    });

    it('treats an empty or null poId as no selection', async () => {
      mockMatchingService.getPoMatch.mockResolvedValue({ resolution: 'NO_REFERENCE', lines: [] });

      await controller.previewPoMatch('inv-1', { poId: null, lines }, mockUser);
      expect(mockMatchingService.getPoMatch).toHaveBeenCalledWith(
        'inv-1',
        mockUser,
        undefined,
        lines,
      );

      await controller.previewPoMatch('inv-1', { poId: '', lines }, mockUser);
      expect(mockMatchingService.getPoMatch).toHaveBeenLastCalledWith(
        'inv-1',
        mockUser,
        undefined,
        lines,
      );
    });
  });

  describe('getPoInfo (FOR-355)', () => {
    it('delegates to the matching service', async () => {
      const expected = { match: { resolution: 'LINKED' }, deliveryReports: [] };
      mockMatchingService.getPoInfo.mockResolvedValue(expected);

      const result = await controller.getPoInfo('inv-1', mockUser);
      expect(mockMatchingService.getPoInfo).toHaveBeenCalledWith('inv-1', mockUser, undefined);
      expect(result).toEqual(expected);
    });

    it("passes the review form's unsaved PO pick through and treats an empty poId as absent", async () => {
      mockMatchingService.getPoInfo.mockResolvedValue({ match: {}, deliveryReports: [] });

      await controller.getPoInfo('inv-1', mockUser, 'po-9');
      expect(mockMatchingService.getPoInfo).toHaveBeenCalledWith('inv-1', mockUser, 'po-9');

      await controller.getPoInfo('inv-1', mockUser, '');
      expect(mockMatchingService.getPoInfo).toHaveBeenLastCalledWith('inv-1', mockUser, undefined);
    });
  });

  describe('exportRelatedPo (FOR-355)', () => {
    it('delegates to the matching service', async () => {
      const expected = { url: 'https://signed/po.pdf' };
      mockMatchingService.exportRelatedPoPdf.mockResolvedValue(expected);

      const result = await controller.exportRelatedPo('inv-1', mockUser);
      expect(mockMatchingService.exportRelatedPoPdf).toHaveBeenCalledWith(
        'inv-1',
        mockUser,
        undefined,
      );
      expect(result).toEqual(expected);
    });

    it("passes the displayed PO's id through and treats an empty poId as absent", async () => {
      mockMatchingService.exportRelatedPoPdf.mockResolvedValue({ url: 'u' });

      await controller.exportRelatedPo('inv-1', mockUser, 'po-9');
      expect(mockMatchingService.exportRelatedPoPdf).toHaveBeenCalledWith(
        'inv-1',
        mockUser,
        'po-9',
      );

      await controller.exportRelatedPo('inv-1', mockUser, '');
      expect(mockMatchingService.exportRelatedPoPdf).toHaveBeenLastCalledWith(
        'inv-1',
        mockUser,
        undefined,
      );
    });
  });

  describe('reviewInvoice', () => {
    it('delegates to service', async () => {
      const dto = { vendorId: 'vendor-1', lines: [] } as never;
      const expected = { id: 'inv-1', reviewedAt: '2026-07-28T00:00:00.000Z' };
      mockService.reviewInvoice.mockResolvedValue(expected);

      const result = await controller.reviewInvoice('inv-1', dto, mockUser);
      expect(mockService.reviewInvoice).toHaveBeenCalledWith('inv-1', dto, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('getInvoiceAudit', () => {
    it('delegates to service', async () => {
      const expected = [{ id: 'log-1', action: 'INVOICE_APPROVED' }];
      mockService.getAuditTrail.mockResolvedValue(expected);

      const result = await controller.getInvoiceAudit('inv-1', mockUser);
      expect(mockService.getAuditTrail).toHaveBeenCalledWith('inv-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('approveInvoice', () => {
    it('delegates to service with the optional reason (FOR-294)', async () => {
      const expected = { id: 'inv-1', status: 'APPROVED' };
      mockService.approveInvoice.mockResolvedValue(expected);

      const dto = { reason: 'Checked against the PO.' };
      const result = await controller.approveInvoice('inv-1', dto, mockUser);
      expect(mockService.approveInvoice).toHaveBeenCalledWith('inv-1', dto, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('bulkApproveInvoices', () => {
    it('delegates to service', async () => {
      const expected = { approvedCount: 2, requestedCount: 2 };
      mockService.bulkApproveInvoices.mockResolvedValue(expected);

      const result = await controller.bulkApproveInvoices({ ids: ['inv-1', 'inv-2'] }, mockUser);
      expect(mockService.bulkApproveInvoices).toHaveBeenCalledWith(['inv-1', 'inv-2'], mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('exportInvoices', () => {
    it('delegates to export service', async () => {
      const expected = { url: 'https://storage/invoices.csv' };
      mockExportService.exportInvoices.mockResolvedValue(expected);
      const query = { page: 1 };

      const result = await controller.exportInvoices('csv', query as never, mockUser);
      expect(mockExportService.exportInvoices).toHaveBeenCalledWith('csv', query, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('exportSingleInvoice', () => {
    it('delegates to export service', async () => {
      const expected = { url: 'https://storage/invoice.pdf' };
      mockExportService.exportSingleInvoice.mockResolvedValue(expected);

      const result = await controller.exportSingleInvoice('inv-1', 'pdf', mockUser);
      expect(mockExportService.exportSingleInvoice).toHaveBeenCalledWith('inv-1', 'pdf', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('rejectInvoice', () => {
    it('delegates to service', async () => {
      const expected = { id: 'inv-1', status: 'REJECTED' };
      mockService.rejectInvoice.mockResolvedValue(expected);

      const result = await controller.rejectInvoice('inv-1', {}, mockUser);
      expect(mockService.rejectInvoice).toHaveBeenCalledWith('inv-1', {}, mockUser);
      expect(result).toEqual(expected);
    });

    it('forwards the discrepancy reason', async () => {
      mockService.rejectInvoice.mockResolvedValue({ id: 'inv-1', status: 'REJECTED' });

      await controller.rejectInvoice('inv-1', { reason: 'Wrong quantities' }, mockUser);
      expect(mockService.rejectInvoice).toHaveBeenCalledWith(
        'inv-1',
        { reason: 'Wrong quantities' },
        mockUser,
      );
    });
  });

  describe('uploadInvoice', () => {
    it('delegates to the intake service', async () => {
      const expected = { id: 'inv-9', status: 'PENDING', source: 'MANUAL' };
      mockIntakeService.uploadInvoice.mockResolvedValue(expected);
      const file = { originalname: 'invoice.pdf' } as Express.Multer.File;

      const result = await controller.uploadInvoice(file, mockUser);
      expect(mockIntakeService.uploadInvoice).toHaveBeenCalledWith(file, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('getIntakeAddress', () => {
    it('delegates to the intake service', async () => {
      const expected = { email: 'invoices-abc@in.example.com' };
      mockIntakeService.getIntakeAddress.mockResolvedValue(expected);

      const result = await controller.getIntakeAddress(mockUser);
      expect(mockIntakeService.getIntakeAddress).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('uploadDocument', () => {
    it('delegates to service', async () => {
      const expected = { id: 'doc-1', name: 'receipt.pdf' };
      mockService.uploadDocument.mockResolvedValue(expected);
      const file = { originalname: 'receipt.pdf' } as Express.Multer.File;

      const result = await controller.uploadDocument('inv-1', file, mockUser);
      expect(mockService.uploadDocument).toHaveBeenCalledWith('inv-1', file, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('deleteDocument', () => {
    it('delegates to service', async () => {
      const expected = { success: true };
      mockService.deleteDocument.mockResolvedValue(expected);

      const result = await controller.deleteDocument('inv-1', 'doc-1', mockUser);
      expect(mockService.deleteDocument).toHaveBeenCalledWith('inv-1', 'doc-1', mockUser);
      expect(result).toEqual(expected);
    });
  });
});
