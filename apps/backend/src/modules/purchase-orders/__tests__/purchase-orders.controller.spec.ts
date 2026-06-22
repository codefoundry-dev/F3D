import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';

import { PoChangeService } from '../po-change.service';
import { PoDocumentService } from '../po-document.service';
import { PoExportService } from '../po-export.service';
import { PoStatusService } from '../po-status.service';
import { PoValidationService } from '../po-validation.service';
import { PurchaseOrdersController } from '../purchase-orders.controller';
import { PurchaseOrdersService } from '../purchase-orders.service';

const mockService = {
  listPurchaseOrders: jest.fn(),
  getPurchaseOrder: jest.fn(),
  getPurchaseOrderById: jest.fn(),
  createPurchaseOrder: jest.fn(),
  updatePurchaseOrder: jest.fn(),
  copyPurchaseOrder: jest.fn(),
};

const mockExportService = {
  exportPos: jest.fn(),
  exportPublicPoPdf: jest.fn(),
};

const mockDocumentService = {
  uploadDocument: jest.fn(),
  deleteDocument: jest.fn(),
};

const mockStatusService = {
  issuePurchaseOrder: jest.fn(),
  confirmPurchaseOrder: jest.fn(),
  approvePurchaseOrder: jest.fn(),
  declinePurchaseOrder: jest.fn(),
  archivePurchaseOrder: jest.fn(),
  acceptPurchaseOrder: jest.fn(),
  vendorDeclinePurchaseOrder: jest.fn(),
  confirmPurchaseOrderViaToken: jest.fn(),
  acceptPurchaseOrderViaToken: jest.fn(),
  vendorDeclinePurchaseOrderViaToken: jest.fn(),
  receivePurchaseOrder: jest.fn(),
  listPendingApproval: jest.fn(),
  getAuditTrail: jest.fn(),
};

const mockValidationService = {
  validateItems: jest.fn(),
};

const mockChangeService = {
  proposeChange: jest.fn(),
  listChangeRequests: jest.fn(),
  approveChange: jest.fn(),
  rejectChange: jest.fn(),
};

const mockUser = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};

describe('PurchaseOrdersController', () => {
  let controller: PurchaseOrdersController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseOrdersController],
      providers: [
        { provide: PurchaseOrdersService, useValue: mockService },
        { provide: PoExportService, useValue: mockExportService },
        { provide: PoDocumentService, useValue: mockDocumentService },
        { provide: PoStatusService, useValue: mockStatusService },
        { provide: PoValidationService, useValue: mockValidationService },
        { provide: PoChangeService, useValue: mockChangeService },
      ],
    }).compile();

    controller = module.get<PurchaseOrdersController>(PurchaseOrdersController);
  });

  describe('tokenised vendor PO portal (FOR-246)', () => {
    // The access token resolved by the guard binds the request to one PO — the
    // controller reads the PO id from the token's subject, never from the caller.
    const token = { id: 'tok-1', subjectId: 'po-99' };

    it('getPublicPurchaseOrder loads the PO named by the token subject', async () => {
      const expected = { id: 'po-99', poNumber: 'PO-99' };
      mockService.getPurchaseOrderById.mockResolvedValue(expected);

      const result = await controller.getPublicPurchaseOrder(token as never);

      expect(mockService.getPurchaseOrderById).toHaveBeenCalledWith('po-99');
      expect(result).toEqual(expected);
    });

    it('exportPublicPurchaseOrderPdf returns a PDF url for the token subject', async () => {
      mockExportService.exportPublicPoPdf.mockResolvedValue({ url: 'https://files/po-99.pdf' });

      const result = await controller.exportPublicPurchaseOrderPdf(token as never);

      expect(mockExportService.exportPublicPoPdf).toHaveBeenCalledWith('po-99');
      expect(result).toEqual({ url: 'https://files/po-99.pdf' });
    });
  });

  describe('tokenised vendor PO actions (FOR-247)', () => {
    // The action endpoints resolve the PO from the token's subject too — never a
    // path param — so a token can only ever act on its own PO.
    const token = { id: 'tok-1', subjectId: 'po-99' };

    it('acknowledgePublicPurchaseOrder confirms the token subject', async () => {
      mockStatusService.confirmPurchaseOrderViaToken.mockResolvedValue({ status: 'ACKNOWLEDGED' });

      const result = await controller.acknowledgePublicPurchaseOrder(token as never);

      expect(mockStatusService.confirmPurchaseOrderViaToken).toHaveBeenCalledWith('po-99');
      expect(result).toEqual({ status: 'ACKNOWLEDGED' });
    });

    it('acceptPublicPurchaseOrder forwards the body for the token subject', async () => {
      mockStatusService.acceptPurchaseOrderViaToken.mockResolvedValue({ status: 'ACCEPTED' });
      const dto = { paymentTermsDays: 30 };

      const result = await controller.acceptPublicPurchaseOrder(token as never, dto as never);

      expect(mockStatusService.acceptPurchaseOrderViaToken).toHaveBeenCalledWith('po-99', dto);
      expect(result).toEqual({ status: 'ACCEPTED' });
    });

    it('declinePublicPurchaseOrder forwards the reason for the token subject', async () => {
      mockStatusService.vendorDeclinePurchaseOrderViaToken.mockResolvedValue({
        status: 'CANCELLED_BY_VENDOR',
      });
      const dto = { reason: 'Out of stock' };

      const result = await controller.declinePublicPurchaseOrder(token as never, dto as never);

      expect(mockStatusService.vendorDeclinePurchaseOrderViaToken).toHaveBeenCalledWith(
        'po-99',
        dto,
      );
      expect(result).toEqual({ status: 'CANCELLED_BY_VENDOR' });
    });
  });

  describe('listPurchaseOrders', () => {
    it('delegates to service', async () => {
      const query = { page: 1 };
      const expected = { items: [], meta: { page: 1, limit: 25, total: 0, totalPages: 0 } };
      mockService.listPurchaseOrders.mockResolvedValue(expected);

      const result = await controller.listPurchaseOrders(query as never, mockUser);
      expect(mockService.listPurchaseOrders).toHaveBeenCalledWith(query, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('getPurchaseOrder', () => {
    it('delegates to service', async () => {
      const expected = { id: 'po-1' };
      mockService.getPurchaseOrder.mockResolvedValue(expected);

      const result = await controller.getPurchaseOrder('po-1', mockUser);
      expect(mockService.getPurchaseOrder).toHaveBeenCalledWith('po-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('createPurchaseOrder', () => {
    it('delegates to service', async () => {
      const expected = { id: 'po-new' };
      mockService.createPurchaseOrder.mockResolvedValue(expected);
      const dto = { projectId: 'proj-1' };

      const result = await controller.createPurchaseOrder(dto as never, mockUser);
      expect(mockService.createPurchaseOrder).toHaveBeenCalledWith(dto, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('updatePurchaseOrder', () => {
    it('delegates to service', async () => {
      const expected = { id: 'po-1' };
      mockService.updatePurchaseOrder.mockResolvedValue(expected);
      const dto = { vendorId: 'v-2' };

      const result = await controller.updatePurchaseOrder('po-1', dto as never, mockUser);
      expect(mockService.updatePurchaseOrder).toHaveBeenCalledWith('po-1', dto, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('issuePurchaseOrder', () => {
    it('delegates to status service', async () => {
      const expected = { id: 'po-1', status: 'SENT' };
      mockStatusService.issuePurchaseOrder.mockResolvedValue(expected);

      const result = await controller.issuePurchaseOrder('po-1', mockUser);
      expect(mockStatusService.issuePurchaseOrder).toHaveBeenCalledWith('po-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('exportPurchaseOrders', () => {
    it('delegates to export service', async () => {
      const expected = { url: 'https://storage/pos.csv' };
      mockExportService.exportPos.mockResolvedValue(expected);
      const query = { page: 1 };

      const result = await controller.exportPurchaseOrders('csv', query as never, mockUser);
      expect(mockExportService.exportPos).toHaveBeenCalledWith('csv', query, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('copyPurchaseOrder', () => {
    it('delegates to service', async () => {
      const expected = { id: 'po-copy-1' };
      mockService.copyPurchaseOrder.mockResolvedValue(expected);

      const result = await controller.copyPurchaseOrder('po-1', mockUser);
      expect(mockService.copyPurchaseOrder).toHaveBeenCalledWith('po-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('archivePurchaseOrder', () => {
    it('delegates to status service', async () => {
      const expected = { success: true };
      mockStatusService.archivePurchaseOrder.mockResolvedValue(expected);

      const result = await controller.archivePurchaseOrder('po-1', mockUser);
      expect(mockStatusService.archivePurchaseOrder).toHaveBeenCalledWith('po-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('approvePurchaseOrder', () => {
    it('delegates to status service', async () => {
      const expected = { id: 'po-1', status: 'ACKNOWLEDGED' };
      mockStatusService.approvePurchaseOrder.mockResolvedValue(expected);

      const result = await controller.approvePurchaseOrder('po-1', mockUser);
      expect(mockStatusService.approvePurchaseOrder).toHaveBeenCalledWith('po-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('declinePurchaseOrder', () => {
    it('delegates to status service', async () => {
      const expected = { id: 'po-1', status: 'CANCELLED' };
      mockStatusService.declinePurchaseOrder.mockResolvedValue(expected);
      const dto = { reason: 'No longer required' };

      const result = await controller.declinePurchaseOrder('po-1', dto as never, mockUser);
      expect(mockStatusService.declinePurchaseOrder).toHaveBeenCalledWith('po-1', dto, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('acceptPurchaseOrder', () => {
    it('delegates to status service', async () => {
      const expected = { id: 'po-1', status: 'ACCEPTED' };
      mockStatusService.acceptPurchaseOrder.mockResolvedValue(expected);
      const dto = { paymentTermsDays: 30 };

      const result = await controller.acceptPurchaseOrder('po-1', dto as never, mockUser);
      expect(mockStatusService.acceptPurchaseOrder).toHaveBeenCalledWith('po-1', dto, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('vendorDeclinePurchaseOrder', () => {
    it('delegates to status service', async () => {
      const expected = { id: 'po-1', status: 'CANCELLED_BY_VENDOR' };
      mockStatusService.vendorDeclinePurchaseOrder.mockResolvedValue(expected);
      const dto = { reason: 'Out of stock' };

      const result = await controller.vendorDeclinePurchaseOrder('po-1', dto as never, mockUser);
      expect(mockStatusService.vendorDeclinePurchaseOrder).toHaveBeenCalledWith(
        'po-1',
        dto,
        mockUser,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('listPendingApproval', () => {
    it('delegates to status service', async () => {
      const expected = { items: [{ id: 'po-1' }] };
      mockStatusService.listPendingApproval.mockResolvedValue(expected);

      const result = await controller.listPendingApproval(mockUser);
      expect(mockStatusService.listPendingApproval).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('receivePurchaseOrder', () => {
    it('delegates to status service', async () => {
      const expected = { id: 'po-1', status: 'PARTIALLY_DELIVERED' };
      mockStatusService.receivePurchaseOrder.mockResolvedValue(expected);
      const dto = { lines: [{ lineItemId: 'li-1', quantityDelivered: 5 }] };

      const result = await controller.receivePurchaseOrder('po-1', dto as never, mockUser);
      expect(mockStatusService.receivePurchaseOrder).toHaveBeenCalledWith('po-1', dto, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('getPurchaseOrderAudit', () => {
    it('delegates to status service', async () => {
      const expected = [{ id: 'log-1', action: 'PO_ISSUED' }];
      mockStatusService.getAuditTrail.mockResolvedValue(expected);

      const result = await controller.getPurchaseOrderAudit('po-1', mockUser);
      expect(mockStatusService.getAuditTrail).toHaveBeenCalledWith('po-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('uploadDocument', () => {
    it('delegates to document service', async () => {
      const expected = { id: 'doc-1', name: 'file.pdf' };
      mockDocumentService.uploadDocument.mockResolvedValue(expected);
      const file = { originalname: 'file.pdf' } as Express.Multer.File;

      const result = await controller.uploadDocument('po-1', file, mockUser);
      expect(mockDocumentService.uploadDocument).toHaveBeenCalledWith('po-1', file, mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('deleteDocument', () => {
    it('delegates to document service', async () => {
      const expected = { success: true };
      mockDocumentService.deleteDocument.mockResolvedValue(expected);

      const result = await controller.deleteDocument('po-1', 'doc-1', mockUser);
      expect(mockDocumentService.deleteDocument).toHaveBeenCalledWith('po-1', 'doc-1', mockUser);
      expect(result).toEqual(expected);
    });
  });
});
