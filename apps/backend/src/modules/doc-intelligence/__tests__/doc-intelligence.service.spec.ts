import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocExtractionStatus, DocExtractionType, UserRole } from '@prisma/client';

import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { GeminiService } from '../../gemini/gemini.service';
import { GeminiError } from '../../gemini/gemini.types';
import { StorageService } from '../../storage/storage.service';
import { DocIntelligenceService } from '../doc-intelligence.service';

// ── Helpers ─────────────────────────────────────────────────────────────────

const baseUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'pm@example.com',
  role: UserRole.PROCUREMENT_OFFICER,
  companyId: 'company-1',
};

const otherCompanyUser: AuthenticatedUser = {
  id: 'user-2',
  email: 'other@example.com',
  role: UserRole.PROCUREMENT_OFFICER,
  companyId: 'company-2',
};

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'bom.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-fake'),
    size: 1024,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
    ...overrides,
  };
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Build a real .xlsx buffer so the spreadsheet path exercises exceljs for real. */
async function buildBomXlsx(): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('BOM');
  sheet.addRow(['Description', 'Qty', 'Unit']);
  sheet.addRow(['Cement 25kg bag', 50, 'bag']);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function makeQuery(
  overrides: Partial<{ page: number; limit: number }> = {},
): import('@forethread/shared-types').DocExtractionListQueryDto {
  const query = {
    page: overrides.page ?? 1,
    limit: overrides.limit ?? 20,
  } as import('@forethread/shared-types').DocExtractionListQueryDto;
  return query;
}

function makeService() {
  const prisma = {
    file: {
      create: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    docExtraction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    // BOM extractions match against the PUBLIC catalogue; default to empty so
    // tests that don't care about matching aren't affected.
    material: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn((arr: Promise<unknown>[]) => Promise.all(arr)),
  } as unknown as PrismaService & {
    file: { create: jest.Mock; delete: jest.Mock };
    docExtraction: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    material: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const storage = {
    upload: jest.fn().mockResolvedValue({ bucket: 'bucket', key: 'doc-extractions/file.pdf' }),
    delete: jest.fn().mockResolvedValue(undefined),
  } as unknown as StorageService & {
    upload: jest.Mock;
    delete: jest.Mock;
  };

  const gemini = {
    isConfigured: jest.fn().mockReturnValue(true),
    generate: jest.fn(),
  } as unknown as GeminiService & { isConfigured: jest.Mock; generate: jest.Mock };

  return {
    service: new DocIntelligenceService(prisma, storage, gemini),
    prisma,
    storage,
    gemini,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('DocIntelligenceService', () => {
  describe('createExtraction', () => {
    it('uploads to storage, persists File and DocExtraction, and triggers extraction', async () => {
      const { service, prisma, storage, gemini } = makeService();
      prisma.file.create.mockResolvedValue({ id: 'file-1' });
      prisma.docExtraction.create.mockResolvedValue({
        id: 'job-1',
        type: 'BOM',
        status: 'PENDING',
        file: { id: 'file-1' },
      });
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        type: 'BOM',
        status: 'PENDING',
      });
      prisma.docExtraction.update.mockResolvedValue({});
      gemini.generate.mockResolvedValue({
        text: '{"title":"BOM","items":[]}',
        model: 'gemini-2.5-flash',
        usage: { promptTokenCount: 10, candidatesTokenCount: 5 },
      });

      const result = await service.createExtraction(
        { type: DocExtractionType.BOM, file: makeFile() },
        baseUser,
      );

      expect(storage.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^doc-extractions\/.+\.pdf$/),
        expect.any(Buffer),
        'application/pdf',
      );
      expect(prisma.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          filename: 'bom.pdf',
          mimeType: 'application/pdf',
          uploadedById: 'user-1',
        }),
      });
      expect(prisma.docExtraction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: DocExtractionType.BOM,
          status: DocExtractionStatus.PENDING,
          fileId: 'file-1',
          createdByUserId: 'user-1',
          companyId: 'company-1',
        }),
        include: { file: true },
      });
      expect(result).toMatchObject({ id: 'job-1' });
    });

    it('accepts .xlsx spreadsheet uploads', async () => {
      const { service, prisma, storage, gemini } = makeService();
      prisma.file.create.mockResolvedValue({ id: 'file-1' });
      prisma.docExtraction.create.mockResolvedValue({
        id: 'job-1',
        type: 'BOM',
        status: 'PENDING',
        file: { id: 'file-1' },
      });
      prisma.docExtraction.findUnique.mockResolvedValue({ id: 'job-1', type: 'BOM' });
      prisma.docExtraction.update.mockResolvedValue({});
      gemini.generate.mockResolvedValue({
        text: '{"title":"Sheet BOM","items":[]}',
        model: 'gemini-2.5-flash',
      });

      const file = makeFile({
        originalname: 'bom.xlsx',
        mimetype: XLSX_MIME,
        buffer: await buildBomXlsx(),
      });
      const result = await service.createExtraction(
        { type: DocExtractionType.BOM, file },
        baseUser,
      );

      expect(storage.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^doc-extractions\/.+\.xlsx$/),
        expect.any(Buffer),
        XLSX_MIME,
      );
      expect(result).toMatchObject({ id: 'job-1' });
    });

    it('rejects unsupported MIME types', async () => {
      const { service } = makeService();
      const file = makeFile({ mimetype: 'text/plain' });
      await expect(
        service.createExtraction({ type: DocExtractionType.BOM, file }, baseUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects files larger than 10 MB', async () => {
      const { service } = makeService();
      const file = makeFile({ size: 11 * 1024 * 1024 });
      await expect(
        service.createExtraction({ type: DocExtractionType.BOM, file }, baseUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when Gemini is not configured', async () => {
      const { service, gemini } = makeService();
      gemini.isConfigured.mockReturnValue(false);
      await expect(
        service.createExtraction({ type: DocExtractionType.BOM, file: makeFile() }, baseUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('runExtraction', () => {
    it('updates job to COMPLETED with parsed JSON on success', async () => {
      const { service, prisma, gemini } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        type: DocExtractionType.BOM,
      });
      // Catalogue has an exact match for the extracted "Cement" line.
      prisma.material.findMany.mockResolvedValue([{ id: 'm-cement', name: 'Cement' }]);
      gemini.generate.mockResolvedValue({
        text: '{"title":"Concrete BOM","items":[{"description":"Cement","quantity":"50","unit":"BAGS","targetPrice":"$12.50"}]}',
        model: 'gemini-2.5-flash',
        usage: { promptTokenCount: 12, candidatesTokenCount: 8 },
      });

      await service.runExtraction('job-1', Buffer.from('pdf'), 'application/pdf');

      const updates = prisma.docExtraction.update.mock.calls.map((c) => c[0]);
      expect(updates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            where: { id: 'job-1' },
            data: expect.objectContaining({ status: DocExtractionStatus.PROCESSING }),
          }),
        ]),
      );
      const completed = updates.find((u) => u.data.status === DocExtractionStatus.COMPLETED);
      // rawResult keeps Gemini's raw payload; editedResult is normalized so the
      // BOM review UI gets numeric qty / canonical UoM / numeric targetPrice.
      expect(completed?.data.rawResult).toMatchObject({
        title: 'Concrete BOM',
        items: [{ description: 'Cement', quantity: '50' }],
      });
      // editedResult is normalized AND annotated with the catalogue match +
      // confidence score (exact name → auto-matched at confidence 1).
      expect(completed?.data.editedResult).toMatchObject({
        title: 'Concrete BOM',
        items: [
          {
            description: 'Cement',
            quantity: 50,
            unit: 'bag',
            targetPrice: 12.5,
            matchedMaterialId: 'm-cement',
            matchedMaterialName: 'Cement',
            matchConfidence: 1,
          },
        ],
      });
      expect(completed?.data).toMatchObject({
        model: 'gemini-2.5-flash',
        promptTokens: 12,
        completionTokens: 8,
      });
    });

    it('parses .xlsx uploads to text and sends them to Gemini without an inline document', async () => {
      const { service, prisma, gemini } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        type: DocExtractionType.BOM,
      });
      gemini.generate.mockResolvedValue({
        text: '{"title":"Sheet BOM","items":[]}',
        model: 'gemini-2.5-flash',
      });

      await service.runExtraction('job-1', await buildBomXlsx(), XLSX_MIME);

      expect(gemini.generate).toHaveBeenCalledTimes(1);
      const call = gemini.generate.mock.calls[0][0];
      // Spreadsheets go in as prompt text, never as an inline Gemini document.
      expect(call.documents).toBeUndefined();
      expect(call.prompt).toContain('# Sheet: BOM');
      expect(call.prompt).toContain('Cement 25kg bag\t50\tbag');

      const completed = prisma.docExtraction.update.mock.calls
        .map((c) => c[0])
        .find((u) => u.data.status === DocExtractionStatus.COMPLETED);
      expect(completed?.data.rawResult).toMatchObject({ title: 'Sheet BOM' });
    });

    it('requests deterministic structured output (temperature 0 + responseSchema) for typed jobs', async () => {
      const { service, prisma, gemini } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        type: DocExtractionType.BOM,
      });
      gemini.generate.mockResolvedValue({
        text: '{"title":null,"items":[]}',
        model: 'gemini-2.5-flash',
      });

      await service.runExtraction('job-1', Buffer.from('pdf'), 'application/pdf');

      const call = gemini.generate.mock.calls[0][0];
      expect(call.generationConfig).toMatchObject({
        temperature: 0,
        responseMimeType: 'application/json',
      });
      // Constrained decoding pins Gemini to the canonical BOM keys.
      expect(call.generationConfig.responseSchema).toMatchObject({
        type: 'object',
        required: ['items'],
      });
    });

    it('omits responseSchema for GENERIC jobs (free-form contract)', async () => {
      const { service, prisma, gemini } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        type: DocExtractionType.GENERIC,
      });
      gemini.generate.mockResolvedValue({ text: '{}', model: 'gemini-2.5-flash' });

      await service.runExtraction('job-1', Buffer.from('pdf'), 'application/pdf');

      const call = gemini.generate.mock.calls[0][0];
      expect(call.generationConfig.responseSchema).toBeUndefined();
      expect(call.generationConfig).toMatchObject({
        temperature: 0,
        responseMimeType: 'application/json',
      });
    });

    it('normalizes INVOICE extractions into the canonical invoice shape', async () => {
      const { service, prisma, gemini } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        type: DocExtractionType.INVOICE,
      });
      gemini.generate.mockResolvedValue({
        text: JSON.stringify({
          vendor: 'Acme Supplies',
          invoiceNo: 'INV-42',
          currency: 'usd',
          total: '$1,250.00',
          items: [
            { description: 'Cement', qty: '50', uom: 'BAGS', rate: '$12.50', amount: '625.00' },
            { description: '', rate: null }, // header/blank row → dropped
          ],
        }),
        model: 'gemini-2.5-flash',
      });

      await service.runExtraction('job-1', Buffer.from('pdf'), 'application/pdf');

      const completed = prisma.docExtraction.update.mock.calls
        .map((c) => c[0])
        .find((u) => u.data.status === DocExtractionStatus.COMPLETED);
      expect(completed?.data.editedResult).toMatchObject({
        vendorName: 'Acme Supplies',
        invoiceNumber: 'INV-42',
        currency: 'USD',
        totalAmount: 1250,
        items: [
          { description: 'Cement', quantity: 50, unit: 'bag', unitPrice: 12.5, lineTotal: 625 },
        ],
      });
      expect((completed?.data.editedResult as { items: unknown[] }).items).toHaveLength(1);
    });

    it('strips markdown code fences before parsing JSON', async () => {
      const { service, prisma, gemini } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        type: DocExtractionType.GENERIC,
      });
      gemini.generate.mockResolvedValue({
        text: '```json\n{"title":"X","items":[]}\n```',
        model: 'gemini-2.5-flash',
      });

      await service.runExtraction('job-1', Buffer.from('pdf'), 'application/pdf');

      const completed = prisma.docExtraction.update.mock.calls
        .map((c) => c[0])
        .find((u) => u.data.status === DocExtractionStatus.COMPLETED);
      // GENERIC type → no normalization, raw passes straight through to edited.
      expect(completed?.data.rawResult).toEqual({ title: 'X', items: [] });
      expect(completed?.data.editedResult).toEqual({ title: 'X', items: [] });
    });

    it('marks job FAILED with MALFORMED_RESPONSE when Gemini returns non-JSON', async () => {
      const { service, prisma, gemini } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({ id: 'job-1', type: 'BOM' });
      gemini.generate.mockResolvedValue({ text: 'sorry, no JSON', model: 'gemini-2.5-flash' });

      await service.runExtraction('job-1', Buffer.from('pdf'), 'application/pdf');

      const failed = prisma.docExtraction.update.mock.calls
        .map((c) => c[0])
        .find((u) => u.data.status === DocExtractionStatus.FAILED);
      expect(failed?.data).toMatchObject({
        status: DocExtractionStatus.FAILED,
        errorCode: 'MALFORMED_RESPONSE',
      });
    });

    it('records Gemini error codes verbatim when Gemini throws', async () => {
      const { service, prisma, gemini } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({ id: 'job-1', type: 'BOM' });
      gemini.generate.mockRejectedValue(new GeminiError('TIMEOUT', 'too slow'));

      await service.runExtraction('job-1', Buffer.from('pdf'), 'application/pdf');

      const failed = prisma.docExtraction.update.mock.calls
        .map((c) => c[0])
        .find((u) => u.data.status === DocExtractionStatus.FAILED);
      expect(failed?.data).toMatchObject({
        status: DocExtractionStatus.FAILED,
        errorCode: 'TIMEOUT',
        errorMessage: 'too slow',
      });
    });

    it('returns silently when the job no longer exists', async () => {
      const { service, prisma } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue(null);
      await expect(
        service.runExtraction('missing', Buffer.from('pdf'), 'application/pdf'),
      ).resolves.toBeUndefined();
      expect(prisma.docExtraction.update).not.toHaveBeenCalled();
    });
  });

  describe('getExtraction (access control)', () => {
    it('returns the job when the caller is the creator', async () => {
      const { service, prisma } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        createdByUserId: 'user-1',
        companyId: 'company-1',
        file: { id: 'file-1' },
      });
      await expect(service.getExtraction('job-1', baseUser)).resolves.toMatchObject({
        id: 'job-1',
      });
    });

    it('returns the job to another user in the same company', async () => {
      const { service, prisma } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        createdByUserId: 'someone-else',
        companyId: 'company-1',
        file: { id: 'file-1' },
      });
      await expect(service.getExtraction('job-1', baseUser)).resolves.toMatchObject({
        id: 'job-1',
      });
    });

    it('throws 404 to users from a different company', async () => {
      const { service, prisma } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        createdByUserId: 'user-1',
        companyId: 'company-1',
        file: { id: 'file-1' },
      });
      await expect(service.getExtraction('job-1', otherCompanyUser)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws 404 when the job does not exist', async () => {
      const { service, prisma } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue(null);
      await expect(service.getExtraction('missing', baseUser)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateExtraction', () => {
    it('saves edits while job is COMPLETED', async () => {
      const { service, prisma } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        createdByUserId: 'user-1',
        companyId: 'company-1',
        status: DocExtractionStatus.COMPLETED,
        file: { id: 'file-1' },
      });
      prisma.docExtraction.update.mockResolvedValue({
        id: 'job-1',
        editedResult: { foo: 'bar' },
        file: { id: 'file-1' },
      });

      const result = await service.updateExtraction('job-1', { foo: 'bar' }, baseUser);
      expect(result).toMatchObject({ id: 'job-1' });
      const updateCall = prisma.docExtraction.update.mock.calls.find((c) => c[0].data.editedResult);
      expect(updateCall?.[0].data).toMatchObject({
        editedResult: { foo: 'bar' },
        lastEditedByUserId: 'user-1',
      });
      expect(updateCall?.[0].data.lastEditedAt).toBeInstanceOf(Date);
    });

    it('rejects edits when job is PROCESSING', async () => {
      const { service, prisma } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        createdByUserId: 'user-1',
        companyId: 'company-1',
        status: DocExtractionStatus.PROCESSING,
        file: { id: 'file-1' },
      });
      await expect(
        service.updateExtraction('job-1', { foo: 'bar' }, baseUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('confirmExtraction', () => {
    it('transitions COMPLETED → CONFIRMED and persists final edits', async () => {
      const { service, prisma } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        createdByUserId: 'user-1',
        companyId: 'company-1',
        status: DocExtractionStatus.COMPLETED,
        file: { id: 'file-1' },
      });
      prisma.docExtraction.update.mockResolvedValue({
        id: 'job-1',
        status: DocExtractionStatus.CONFIRMED,
        file: { id: 'file-1' },
      });

      await service.confirmExtraction('job-1', { title: 'final' }, baseUser);

      expect(prisma.docExtraction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DocExtractionStatus.CONFIRMED,
            editedResult: { title: 'final' },
            confirmedByUserId: 'user-1',
            lastEditedByUserId: 'user-1',
          }),
        }),
      );
      const confirmCall = prisma.docExtraction.update.mock.calls.find(
        (c) => c[0].data.status === DocExtractionStatus.CONFIRMED,
      );
      expect(confirmCall?.[0].data.confirmedAt).toBeInstanceOf(Date);
    });

    it('drops still-unmatched BOM lines when confirming (the proceed gate)', async () => {
      const { service, prisma } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        type: DocExtractionType.BOM,
        createdByUserId: 'user-1',
        companyId: 'company-1',
        status: DocExtractionStatus.COMPLETED,
        file: { id: 'file-1' },
      });
      prisma.docExtraction.update.mockResolvedValue({
        id: 'job-1',
        status: DocExtractionStatus.CONFIRMED,
        file: { id: 'file-1' },
      });

      // Final review state: one auto-matched line, one matched by hand, one
      // the user left unmatched. Only the matched two should be persisted.
      const line = (id: string | null, confidence: number | null) => ({
        description: id ?? 'Mystery widget',
        quantity: 1,
        unit: 'ea',
        targetPrice: null,
        notes: null,
        matchedMaterialId: id,
        matchedMaterialName: id ? `Material ${id}` : null,
        matchConfidence: confidence,
        matchCandidates: [],
      });
      const edited = {
        title: 'Concrete BOM',
        projectName: null,
        currency: 'AUD',
        notes: null,
        items: [line('m-rebar', 1), line('m-cement', null), line(null, null)],
      };

      await service.confirmExtraction('job-1', edited, baseUser);

      const confirmCall = prisma.docExtraction.update.mock.calls.find(
        (c) => c[0].data.status === DocExtractionStatus.CONFIRMED,
      );
      const saved = confirmCall?.[0].data.editedResult as {
        items: Array<{ matchedMaterialId: string | null }>;
      };
      expect(saved.items.map((i) => i.matchedMaterialId)).toEqual(['m-rebar', 'm-cement']);
    });

    it('prunes unmatched lines from the stored BOM even when the user makes no edits', async () => {
      const { service, prisma } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        type: DocExtractionType.BOM,
        createdByUserId: 'user-1',
        companyId: 'company-1',
        status: DocExtractionStatus.COMPLETED,
        editedResult: {
          title: 'BOM',
          projectName: null,
          currency: null,
          notes: null,
          items: [
            {
              description: 'Matched',
              quantity: 1,
              unit: 'ea',
              targetPrice: null,
              notes: null,
              matchedMaterialId: 'm-1',
              matchedMaterialName: 'M1',
              matchConfidence: 1,
              matchCandidates: [],
            },
            {
              description: 'Unmatched',
              quantity: 1,
              unit: 'ea',
              targetPrice: null,
              notes: null,
              matchedMaterialId: null,
              matchedMaterialName: null,
              matchConfidence: null,
              matchCandidates: [],
            },
          ],
        },
        file: { id: 'file-1' },
      });
      prisma.docExtraction.update.mockResolvedValue({
        id: 'job-1',
        status: DocExtractionStatus.CONFIRMED,
        file: { id: 'file-1' },
      });

      await service.confirmExtraction('job-1', undefined, baseUser);

      const confirmCall = prisma.docExtraction.update.mock.calls.find(
        (c) => c[0].data.status === DocExtractionStatus.CONFIRMED,
      );
      const data = confirmCall?.[0].data;
      const saved = data?.editedResult as { items: Array<{ matchedMaterialId: string | null }> };
      expect(saved.items.map((i) => i.matchedMaterialId)).toEqual(['m-1']);
      // No manual edit was submitted, so the system drop is not attributed to the user.
      expect(data?.lastEditedByUserId).toBeUndefined();
    });

    it('refuses to confirm when not in COMPLETED', async () => {
      const { service, prisma } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        createdByUserId: 'user-1',
        companyId: 'company-1',
        status: DocExtractionStatus.PROCESSING,
        file: { id: 'file-1' },
      });
      await expect(service.confirmExtraction('job-1', undefined, baseUser)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('refuses to re-confirm an already CONFIRMED job', async () => {
      const { service, prisma } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        createdByUserId: 'user-1',
        companyId: 'company-1',
        status: DocExtractionStatus.CONFIRMED,
        file: { id: 'file-1' },
      });
      await expect(service.confirmExtraction('job-1', undefined, baseUser)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('listExtractions', () => {
    it('scopes by createdByUserId for users with no company', async () => {
      const { service, prisma } = makeService();
      prisma.docExtraction.findMany.mockResolvedValue([]);
      prisma.docExtraction.count.mockResolvedValue(0);

      await service.listExtractions(makeQuery(), { ...baseUser, companyId: null });

      const where = prisma.docExtraction.findMany.mock.calls[0][0].where;
      expect(where).toEqual(expect.objectContaining({ createdByUserId: 'user-1' }));
    });

    it('returns OR(company, creator) scoping for users with a company', async () => {
      const { service, prisma } = makeService();
      prisma.docExtraction.findMany.mockResolvedValue([]);
      prisma.docExtraction.count.mockResolvedValue(0);

      await service.listExtractions(makeQuery(), baseUser);

      const where = prisma.docExtraction.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ companyId: 'company-1' }, { createdByUserId: 'user-1' }]);
    });

    it('applies no scope for SUPER_ADMIN', async () => {
      const { service, prisma } = makeService();
      prisma.docExtraction.findMany.mockResolvedValue([]);
      prisma.docExtraction.count.mockResolvedValue(0);

      await service.listExtractions(makeQuery(), { ...baseUser, role: UserRole.SUPER_ADMIN });

      const where = prisma.docExtraction.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeUndefined();
      expect(where.createdByUserId).toBeUndefined();
    });
  });

  describe('deleteExtraction', () => {
    it('removes the doc-extraction row, S3 object, and file row', async () => {
      const { service, prisma, storage } = makeService();
      prisma.docExtraction.findUnique.mockResolvedValue({
        id: 'job-1',
        createdByUserId: 'user-1',
        companyId: 'company-1',
        fileId: 'file-1',
        file: { id: 'file-1', key: 's3-key' },
      });

      await service.deleteExtraction('job-1', baseUser);

      expect(prisma.docExtraction.delete).toHaveBeenCalledWith({ where: { id: 'job-1' } });
      expect(storage.delete).toHaveBeenCalledWith('s3-key');
      expect(prisma.file.delete).toHaveBeenCalledWith({ where: { id: 'file-1' } });
    });
  });
});
