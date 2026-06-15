import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';

import { MaterialRequestsController } from '../material-requests.controller';
import { MaterialRequestsService } from '../material-requests.service';

const mockService = {
  create: jest.fn(),
  list: jest.fn(),
  get: jest.fn(),
  getAuditTrail: jest.fn(),
  update: jest.fn(),
  submit: jest.fn(),
  approve: jest.fn(),
  decline: jest.fn(),
  cancel: jest.fn(),
  convertToRfq: jest.fn(),
  convertToPo: jest.fn(),
};

const mockUser = {
  id: 'fm-1',
  email: 'foreman@test.com',
  role: UserRole.FOREMAN,
  companyId: 'comp-1',
};

describe('MaterialRequestsController', () => {
  let controller: MaterialRequestsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaterialRequestsController],
      providers: [{ provide: MaterialRequestsService, useValue: mockService }],
    }).compile();

    controller = module.get<MaterialRequestsController>(MaterialRequestsController);
  });

  describe('create', () => {
    it('delegates to service (user first, then dto)', async () => {
      const expected = { id: 'mr-1' };
      mockService.create.mockResolvedValue(expected);
      const dto = { projectId: 'proj-1', lineItems: [] };

      const result = await controller.create(dto as never, mockUser);
      expect(mockService.create).toHaveBeenCalledWith(mockUser, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('list', () => {
    it('delegates to service', async () => {
      const expected = { items: [] };
      mockService.list.mockResolvedValue(expected);
      const query = { mine: true };

      const result = await controller.list(query as never, mockUser);
      expect(mockService.list).toHaveBeenCalledWith(mockUser, query);
      expect(result).toEqual(expected);
    });
  });

  describe('get', () => {
    it('delegates to service', async () => {
      const expected = { id: 'mr-1' };
      mockService.get.mockResolvedValue(expected);

      const result = await controller.get('mr-1', mockUser);
      expect(mockService.get).toHaveBeenCalledWith('mr-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('getAuditTrail', () => {
    it('delegates to service', async () => {
      const expected = [{ id: 'log-1', action: 'MATERIAL_REQUEST_CREATED' }];
      mockService.getAuditTrail.mockResolvedValue(expected);

      const result = await controller.getAuditTrail('mr-1', mockUser);
      expect(mockService.getAuditTrail).toHaveBeenCalledWith('mr-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('delegates to service', async () => {
      const expected = { id: 'mr-1' };
      mockService.update.mockResolvedValue(expected);
      const dto = { note: 'updated' };

      const result = await controller.update('mr-1', dto as never, mockUser);
      expect(mockService.update).toHaveBeenCalledWith('mr-1', mockUser, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('submit', () => {
    it('delegates to service', async () => {
      const expected = { id: 'mr-1', status: 'SUBMITTED' };
      mockService.submit.mockResolvedValue(expected);

      const result = await controller.submit('mr-1', mockUser);
      expect(mockService.submit).toHaveBeenCalledWith('mr-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('approve', () => {
    it('delegates to service', async () => {
      const expected = { id: 'mr-1', status: 'APPROVED' };
      mockService.approve.mockResolvedValue(expected);

      const result = await controller.approve('mr-1', mockUser);
      expect(mockService.approve).toHaveBeenCalledWith('mr-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('decline', () => {
    it('delegates to service', async () => {
      const expected = { id: 'mr-1', status: 'DECLINED' };
      mockService.decline.mockResolvedValue(expected);
      const dto = { reason: 'Not needed' };

      const result = await controller.decline('mr-1', dto as never, mockUser);
      expect(mockService.decline).toHaveBeenCalledWith('mr-1', mockUser, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('cancel', () => {
    it('delegates to service', async () => {
      const expected = { id: 'mr-1', status: 'CANCELLED' };
      mockService.cancel.mockResolvedValue(expected);

      const result = await controller.cancel('mr-1', mockUser);
      expect(mockService.cancel).toHaveBeenCalledWith('mr-1', mockUser);
      expect(result).toEqual(expected);
    });
  });

  describe('convertToRfq', () => {
    it('delegates to service', async () => {
      const expected = { rfqId: 'rfq-1', rfqNumber: 'RFQ-00001' };
      mockService.convertToRfq.mockResolvedValue(expected);
      const dto = { name: 'From MR' };

      const result = await controller.convertToRfq('mr-1', dto as never, mockUser);
      expect(mockService.convertToRfq).toHaveBeenCalledWith('mr-1', mockUser, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('convertToPo', () => {
    it('delegates to service', async () => {
      const expected = { poId: 'po-1', poNumber: 'PO-00001' };
      mockService.convertToPo.mockResolvedValue(expected);
      const dto = { vendorId: 'v-1' };

      const result = await controller.convertToPo('mr-1', dto as never, mockUser);
      expect(mockService.convertToPo).toHaveBeenCalledWith('mr-1', mockUser, dto);
      expect(result).toEqual(expected);
    });
  });
});
