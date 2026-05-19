import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';

import { InvoiceExportService } from '../invoice-export.service';
import { InvoicesController } from '../invoices.controller';
import { InvoicesService } from '../invoices.service';

const mockService = {
  listInvoices: jest.fn(),
  getInvoice: jest.fn(),
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

  describe('approveInvoice', () => {
    it('delegates to service', async () => {
      const expected = { id: 'inv-1', status: 'APPROVED' };
      mockService.approveInvoice.mockResolvedValue(expected);

      const result = await controller.approveInvoice('inv-1', mockUser);
      expect(mockService.approveInvoice).toHaveBeenCalledWith('inv-1', mockUser);
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

      const result = await controller.rejectInvoice('inv-1', mockUser);
      expect(mockService.rejectInvoice).toHaveBeenCalledWith('inv-1', mockUser);
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
