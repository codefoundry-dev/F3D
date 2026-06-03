import { BadRequestException } from '@nestjs/common';

import { DocIntelligenceController } from '../doc-intelligence.controller';

const mockService = {
  createExtraction: jest.fn(),
  listExtractions: jest.fn(),
  getExtraction: jest.fn(),
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
        { type: 'QUOTE', promptHint: 'vendor quote', file },
        user,
      );
      expect(result.id).toBe('ext-1');
      expect(result.usage).toEqual({ promptTokens: 100, completionTokens: 50 });
      expect(result.completedAt).toBe('2026-06-03T00:00:00.000Z');
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

      const result = await controller.get('ext-1', user);

      expect(mockService.getExtraction).toHaveBeenCalledWith('ext-1', user);
      expect(result.id).toBe('ext-1');
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
