import { BadRequestException } from '@nestjs/common';

import { DocIntelligenceController } from '../doc-intelligence.controller';

const mockService = {
  createExtraction: jest.fn(),
  listSheets: jest.fn(),
  listExtractions: jest.fn(),
  getExtraction: jest.fn(),
  getExtractionSummary: jest.fn(),
  getExtractionItems: jest.fn(),
  applyExtractionItemOps: jest.fn(),
  updateExtraction: jest.fn(),
  confirmExtraction: jest.fn(),
  deleteExtraction: jest.fn(),
};

const user = {
  id: 'u-1',
  email: 'u@test.com',
  role: 'COMPANY_ADMIN',
  companyId: 'c-1',
} as never;

const baseFile = {
  id: 'f-1',
  filename: 'quote.pdf',
  mimeType: 'application/pdf',
  size: 1024,
};

/** A fully populated extraction job — exercises the "present" side of every mapper branch. */
function fullJob() {
  const now = new Date('2026-06-03T00:00:00.000Z');
  return {
    id: 'ext-1',
    type: 'QUOTE',
    status: 'COMPLETED',
    file: baseFile,
    rawResult: { lineItems: [] },
    editedResult: { lineItems: [{ name: 'Bolt' }] },
    errorCode: null,
    errorMessage: null,
    model: 'gemini-2.0-flash',
    promptTokens: 100,
    completionTokens: 50,
    createdByUserId: 'u-1',
    lastEditedByUserId: 'u-1',
    confirmedByUserId: 'u-1',
    companyId: 'c-1',
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    lastEditedAt: now,
    confirmedAt: now,
  } as never;
}

/** A freshly-created job — exercises the "null" side of every mapper branch. */
function pendingJob() {
  const now = new Date('2026-06-03T00:00:00.000Z');
  return {
    id: 'ext-2',
    type: 'QUOTE',
    status: 'PENDING',
    file: baseFile,
    rawResult: null,
    editedResult: null,
    errorCode: null,
    errorMessage: null,
    model: null,
    promptTokens: null,
    completionTokens: null,
    createdByUserId: 'u-1',
    lastEditedByUserId: null,
    confirmedByUserId: null,
    companyId: 'c-1',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    lastEditedAt: null,
    confirmedAt: null,
  } as never;
}

describe('DocIntelligenceController', () => {
  let controller: DocIntelligenceController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new DocIntelligenceController(mockService as never);
  });

  describe('create', () => {
    it('creates an extraction job and maps the response', async () => {
      mockService.createExtraction.mockResolvedValue(fullJob());
      const file = { originalname: 'quote.pdf' } as Express.Multer.File;
      const body = { type: 'QUOTE', promptHint: 'vendor quote' } as never;

      const result = await controller.create(file, body, user);

      expect(mockService.createExtraction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'QUOTE', promptHint: 'vendor quote', file }),
        user,
      );
      expect(result.id).toBe('ext-1');
      expect(result.usage).toEqual({ promptTokens: 100, completionTokens: 50 });
      expect(result.completedAt).toBe('2026-06-03T00:00:00.000Z');
    });

    it('forwards the selected spreadsheet sheets to the service', async () => {
      mockService.createExtraction.mockResolvedValue(fullJob());
      const file = { originalname: 'bom.xlsx' } as Express.Multer.File;
      const body = { type: 'BOM', sheetNames: ['HDPE'] } as never;

      await controller.create(file, body, user);

      expect(mockService.createExtraction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'BOM', file, sheetNames: ['HDPE'] }),
        user,
      );
    });

    it('throws BadRequestException when type is missing', async () => {
      const file = { originalname: 'quote.pdf' } as Express.Multer.File;
      const body = { promptHint: 'no type' } as never;

      await expect(controller.create(file, body, user)).rejects.toThrow(BadRequestException);
      expect(mockService.createExtraction).not.toHaveBeenCalled();
    });

    it('maps null usage and null timestamps for a pending job', async () => {
      mockService.createExtraction.mockResolvedValue(pendingJob());
      const file = { originalname: 'quote.pdf' } as Express.Multer.File;
      const body = { type: 'QUOTE' } as never;

      const result = await controller.create(file, body, user);

      expect(result.usage).toBeNull();
      expect(result.rawResult).toBeNull();
      expect(result.editedResult).toBeNull();
      expect(result.completedAt).toBeNull();
      expect(result.lastEditedAt).toBeNull();
      expect(result.confirmedAt).toBeNull();
    });
  });

  describe('listSheets', () => {
    it('returns the worksheet names from the service', async () => {
      mockService.listSheets.mockResolvedValue(['Sheet1', 'HDPE']);
      const file = { originalname: 'bom.xlsx' } as Express.Multer.File;

      const result = await controller.listSheets(file);

      expect(mockService.listSheets).toHaveBeenCalledWith(file);
      expect(result).toEqual({ sheets: ['Sheet1', 'HDPE'] });
    });
  });

  describe('list', () => {
    it('maps each item and passes meta through', async () => {
      const meta = { page: 1, take: 25, total: 1 };
      mockService.listExtractions.mockResolvedValue({ items: [fullJob()], meta });
      const query = { page: 1, take: 25, skip: 0 } as never;

      const result = await controller.list(query, user);

      expect(mockService.listExtractions).toHaveBeenCalledWith(query, user);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('ext-1');
      expect(result.meta).toBe(meta);
    });
  });

  describe('get', () => {
    it('returns the mapped extraction', async () => {
      mockService.getExtraction.mockResolvedValue(fullJob());

      const result = await controller.get('ext-1', {} as never, user);

      expect(mockService.getExtraction).toHaveBeenCalledWith('ext-1', user);
      expect(result.id).toBe('ext-1');
    });

    it('drops the duplicate rawResult for a CATALOGUE job', async () => {
      // A catalogue result can be tens of MB (62k rows) and is stored in both
      // rawResult and editedResult. The catalogue UI only reads editedResult, so
      // the response must never carry the duplicate rawResult — shipping both
      // doubles the payload and OOMs the backend serialising it.
      const job = fullJob() as unknown as Record<string, unknown>;
      mockService.getExtraction.mockResolvedValue({
        ...job,
        type: 'CATALOGUE',
        rawResult: { items: [{ name: 'Hammer' }] },
        editedResult: { items: [{ name: 'Hammer' }] },
      } as never);

      const result = await controller.get('ext-1', {} as never, user);

      expect(result.rawResult).toBeNull();
      expect(result.editedResult).toEqual({ items: [{ name: 'Hammer' }] });
    });

    it('serves resultView=summary without the result payload', async () => {
      const job = fullJob() as unknown as Record<string, unknown>;
      delete job.rawResult;
      delete job.editedResult;
      mockService.getExtractionSummary.mockResolvedValue({
        job,
        summary: { itemCount: 61735, sourceName: 'Electrical Items', notes: null },
      });

      const result = await controller.get('ext-1', { resultView: 'summary' } as never, user);

      expect(mockService.getExtractionSummary).toHaveBeenCalledWith('ext-1', user);
      expect(mockService.getExtraction).not.toHaveBeenCalled();
      expect(result.rawResult).toBeNull();
      expect(result.editedResult).toBeNull();
      expect(result.resultSummary).toEqual({
        itemCount: 61735,
        sourceName: 'Electrical Items',
        notes: null,
      });
    });
  });

  describe('getItems', () => {
    it('passes the window query through to the service', async () => {
      const window = {
        items: [{ name: 'Item 50' }],
        indexes: [50],
        meta: { page: 2, limit: 50, total: 120, totalPages: 3 },
      };
      mockService.getExtractionItems.mockResolvedValue(window);

      const query = { page: 2, limit: 50 } as never;
      const result = await controller.getItems('ext-1', query, user);

      expect(mockService.getExtractionItems).toHaveBeenCalledWith('ext-1', query, user);
      expect(result).toBe(window);
    });
  });

  describe('applyItemOps', () => {
    it('passes the ordered ops through and returns the new count', async () => {
      mockService.applyExtractionItemOps.mockResolvedValue({ itemCount: 99 });
      const ops = [{ op: 'remove', index: 3 }];

      const result = await controller.applyItemOps('ext-1', { ops } as never, user);

      expect(mockService.applyExtractionItemOps).toHaveBeenCalledWith('ext-1', ops, user);
      expect(result).toEqual({ itemCount: 99 });
    });
  });

  describe('update', () => {
    it('saves the edited result and maps the response', async () => {
      mockService.updateExtraction.mockResolvedValue(fullJob());
      const editedResult = { lineItems: [] };

      const result = await controller.update('ext-1', { editedResult } as never, user);

      expect(mockService.updateExtraction).toHaveBeenCalledWith('ext-1', editedResult, user);
      expect(result.id).toBe('ext-1');
    });
  });

  describe('confirm', () => {
    it('confirms the extraction and maps the response', async () => {
      mockService.confirmExtraction.mockResolvedValue(fullJob());
      const editedResult = { lineItems: [] };

      const result = await controller.confirm('ext-1', { editedResult } as never, user);

      expect(mockService.confirmExtraction).toHaveBeenCalledWith('ext-1', editedResult, user);
      expect(result.id).toBe('ext-1');
    });
  });

  describe('delete', () => {
    it('delegates deletion to the service and returns nothing', async () => {
      mockService.deleteExtraction.mockResolvedValue(undefined);

      const result = await controller.delete('ext-1', user);

      expect(mockService.deleteExtraction).toHaveBeenCalledWith('ext-1', user);
      expect(result).toBeUndefined();
    });
  });
});
