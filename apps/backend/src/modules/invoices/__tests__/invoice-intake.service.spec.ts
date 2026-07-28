import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';

import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { DocIntelligenceService } from '../../doc-intelligence/doc-intelligence.service';
import { StorageService } from '../../storage/storage.service';
import { InvoiceIntakeService } from '../invoice-intake.service';
import { ParsedInboundEmail } from '../resend-inbound.types';

const mockPrisma = {
  invoice: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  company: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
};

const mockStorage = {
  upload: jest.fn(),
};

const mockDocIntelligence = {
  createInvoiceExtraction: jest.fn(),
};

const buildConfig = (overrides: Record<string, string> = {}): ConfigService => {
  const values: Record<string, string> = {
    INVOICE_INBOUND_DOMAIN: 'in.test.com',
    RESEND_API_KEY: 're_test_key',
    ...overrides,
  };
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => values[key] ?? defaultValue),
  } as unknown as ConfigService;
};

const buildService = (overrides: Record<string, string> = {}) =>
  new InvoiceIntakeService(
    mockPrisma as unknown as PrismaService,
    mockStorage as unknown as StorageService,
    mockDocIntelligence as unknown as DocIntelligenceService,
    buildConfig(overrides),
  );

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
} as AuthenticatedUser;

const pdfFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
  ({
    originalname: 'invoice.pdf',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('pdf-bytes'),
    ...overrides,
  }) as Express.Multer.File;

const inboundEmail = (overrides: Partial<ParsedInboundEmail> = {}): ParsedInboundEmail => ({
  emailId: 'recv-1',
  from: 'accounts@vendor.com',
  to: ['invoices-abc123@in.test.com'],
  subject: 'Invoice 42',
  ...overrides,
});

const attachment = (overrides: Record<string, unknown> = {}) => ({
  id: 'att-1',
  filename: 'invoice.pdf',
  size: 2048,
  content_type: 'application/pdf',
  content_disposition: 'attachment',
  download_url: 'https://files.resend.com/att-1',
  ...overrides,
});

/** Route fetch calls: the attachments listing vs. attachment downloads. */
const mockFetchRoutes = (attachments: unknown[], downloadOk = true) => {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (String(url).includes('/attachments')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: attachments }) });
    }
    return Promise.resolve({
      ok: downloadOk,
      status: downloadOk ? 200 : 500,
      arrayBuffer: () => Promise.resolve(Buffer.from('file-bytes').buffer),
    });
  });
};

describe('InvoiceIntakeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockStorage.upload.mockResolvedValue({ bucket: 'test-bucket', key: 'some/key' });
    mockDocIntelligence.createInvoiceExtraction.mockResolvedValue(undefined);
  });

  // ── uploadInvoice ──────────────────────────────────────────────────────────

  describe('uploadInvoice', () => {
    const createdInvoice = {
      id: 'inv-1',
      status: 'PENDING',
      source: 'MANUAL',
      createdAt: new Date('2026-07-28T10:00:00Z'),
      documents: [{ id: 'doc-1', file: { id: 'file-1', filename: 'invoice.pdf' } }],
    };

    it('rejects when no file is provided', async () => {
      await expect(
        buildService().uploadInvoice(undefined as never, mockUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects oversized files', async () => {
      const file = pdfFile({ size: 11 * 1024 * 1024 });
      await expect(buildService().uploadInvoice(file, mockUser)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects unsupported file types', async () => {
      const file = pdfFile({ mimetype: 'application/zip', originalname: 'invoice.zip' });
      await expect(buildService().uploadInvoice(file, mockUser)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects users without a company', async () => {
      const user = { ...mockUser, companyId: null } as unknown as AuthenticatedUser;
      await expect(buildService().uploadInvoice(pdfFile(), user)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('stores the file and creates a Pending MANUAL invoice with it attached', async () => {
      mockPrisma.invoice.create.mockResolvedValue(createdInvoice);

      const result = await buildService().uploadInvoice(pdfFile(), mockUser);

      expect(mockStorage.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^invoice-documents\/.+\.pdf$/),
        expect.any(Buffer),
        'application/pdf',
      );

      const createArg = mockPrisma.invoice.create.mock.calls[0][0];
      expect(createArg.data).toMatchObject({
        companyId: 'comp-1',
        createdByUserId: 'user-1',
        source: 'MANUAL',
      });
      expect(createArg.data.documents.create.file.create).toMatchObject({
        bucket: 'test-bucket',
        filename: 'invoice.pdf',
        mimeType: 'application/pdf',
        uploadedById: 'user-1',
      });

      expect(result).toEqual({
        id: 'inv-1',
        status: 'PENDING',
        source: 'MANUAL',
        createdAt: '2026-07-28T10:00:00.000Z',
        documents: [{ id: 'doc-1', name: 'invoice.pdf', fileId: 'file-1' }],
      });
    });

    it('kicks off an extraction for the uploaded file (FOR-291)', async () => {
      mockPrisma.invoice.create.mockResolvedValue(createdInvoice);

      await buildService().uploadInvoice(pdfFile(), mockUser);

      expect(mockDocIntelligence.createInvoiceExtraction).toHaveBeenCalledWith({
        invoiceId: 'inv-1',
        companyId: 'comp-1',
        createdByUserId: 'user-1',
        files: [{ fileId: 'file-1', mimeType: 'application/pdf', data: expect.any(Buffer) }],
      });
    });

    it('still succeeds when starting the extraction fails', async () => {
      mockPrisma.invoice.create.mockResolvedValue(createdInvoice);
      mockDocIntelligence.createInvoiceExtraction.mockRejectedValue(new Error('gemini down'));

      const result = await buildService().uploadInvoice(pdfFile(), mockUser);

      expect(result.id).toBe('inv-1');
    });
  });

  // ── getIntakeAddress ───────────────────────────────────────────────────────

  describe('getIntakeAddress', () => {
    it('rejects users without a company', async () => {
      const user = { ...mockUser, companyId: null } as unknown as AuthenticatedUser;
      await expect(buildService().getIntakeAddress(user)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('returns email: null when inbound email is not configured', async () => {
      const result = await buildService({ INVOICE_INBOUND_DOMAIN: '' }).getIntakeAddress(mockUser);
      expect(result).toEqual({ email: null });
      expect(mockPrisma.company.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('returns the existing inbox key without regenerating it', async () => {
      mockPrisma.company.findUniqueOrThrow.mockResolvedValue({ invoiceInboxKey: 'abc123' });

      const result = await buildService().getIntakeAddress(mockUser);

      expect(result).toEqual({ email: 'invoices-abc123@in.test.com' });
      expect(mockPrisma.company.update).not.toHaveBeenCalled();
    });

    it('generates and persists a key on first view', async () => {
      mockPrisma.company.findUniqueOrThrow.mockResolvedValue({ invoiceInboxKey: null });
      mockPrisma.company.update.mockResolvedValue({});

      const result = await buildService().getIntakeAddress(mockUser);

      const persisted = mockPrisma.company.update.mock.calls[0][0];
      expect(persisted.where).toEqual({ id: 'comp-1' });
      const key = persisted.data.invoiceInboxKey;
      expect(key).toMatch(/^[0-9a-f]{16}$/);
      expect(result).toEqual({ email: `invoices-${key}@in.test.com` });
    });

    it('retries key generation on a unique-constraint collision', async () => {
      mockPrisma.company.findUniqueOrThrow.mockResolvedValue({ invoiceInboxKey: null });
      const clash = new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      });
      mockPrisma.company.update.mockRejectedValueOnce(clash).mockResolvedValue({});

      const result = await buildService().getIntakeAddress(mockUser);

      expect(mockPrisma.company.update).toHaveBeenCalledTimes(2);
      expect(result.email).toMatch(/^invoices-[0-9a-f]{16}@in\.test\.com$/);
    });
  });

  // ── processInboundEmail ────────────────────────────────────────────────────

  describe('processInboundEmail', () => {
    beforeEach(() => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-new' });
    });

    it('ignores emails whose recipients match no company inbox', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      const result = await buildService().processInboundEmail(inboundEmail());

      expect(result).toEqual({
        handled: false,
        reason: 'no-matching-company',
        invoicesCreated: 0,
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('ignores recipients on foreign domains or without the invoices- prefix', async () => {
      const result = await buildService().processInboundEmail(
        inboundEmail({ to: ['invoices-abc@elsewhere.com', 'billing-abc@in.test.com'] }),
      );

      expect(result.reason).toBe('no-matching-company');
      expect(mockPrisma.company.findUnique).not.toHaveBeenCalled();
    });

    it('acks duplicate webhook deliveries without creating anything', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({ id: 'inv-existing' });

      const result = await buildService().processInboundEmail(inboundEmail());

      expect(result).toEqual({ handled: true, reason: 'duplicate-delivery', invoicesCreated: 0 });
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('acks emails with no usable attachments (inline, wrong type, oversized)', async () => {
      mockFetchRoutes([
        attachment({ content_disposition: 'inline', content_type: 'image/png' }),
        attachment({ content_type: 'application/zip', filename: 'archive.zip' }),
        attachment({ size: 11 * 1024 * 1024 }),
      ]);

      const result = await buildService().processInboundEmail(inboundEmail());

      expect(result).toEqual({
        handled: true,
        reason: 'no-usable-attachments',
        invoicesCreated: 0,
      });
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it('creates one EMAIL invoice per PDF attachment', async () => {
      mockFetchRoutes([
        attachment({ id: 'att-1', filename: 'inv-a.pdf' }),
        attachment({ id: 'att-2', filename: 'inv-b.pdf' }),
      ]);

      const result = await buildService().processInboundEmail(inboundEmail());

      expect(result).toEqual({ handled: true, invoicesCreated: 2 });
      expect(mockPrisma.invoice.create).toHaveBeenCalledTimes(2);
      const firstCreate = mockPrisma.invoice.create.mock.calls[0][0];
      expect(firstCreate.data).toMatchObject({
        companyId: 'comp-1',
        source: 'EMAIL',
        senderEmail: 'accounts@vendor.com',
        intakeEmailId: 'recv-1',
      });
      // Email-intake files have no uploading user.
      expect(firstCreate.data.documents.create[0].file.create.filename).toBe('inv-a.pdf');
      expect(firstCreate.data.documents.create[0].file.create).not.toHaveProperty('uploadedById');
    });

    it('groups image attachments into a single invoice alongside per-PDF invoices', async () => {
      mockFetchRoutes([
        attachment({ id: 'att-1', filename: 'inv-a.pdf' }),
        attachment({ id: 'att-2', filename: 'page-1.jpg', content_type: 'image/jpeg' }),
        attachment({ id: 'att-3', filename: 'page-2.jpg', content_type: 'image/jpeg' }),
      ]);

      const result = await buildService().processInboundEmail(inboundEmail());

      expect(result).toEqual({ handled: true, invoicesCreated: 2 });
      const imageCreate = mockPrisma.invoice.create.mock.calls[1][0];
      expect(imageCreate.data.documents.create).toHaveLength(2);
    });

    it('kicks off an unattributed extraction per created invoice (FOR-291)', async () => {
      mockFetchRoutes([
        attachment({ id: 'att-1', filename: 'inv-a.pdf' }),
        attachment({ id: 'att-2', filename: 'page-1.jpg', content_type: 'image/jpeg' }),
        attachment({ id: 'att-3', filename: 'page-2.jpg', content_type: 'image/jpeg' }),
      ]);

      await buildService().processInboundEmail(inboundEmail());

      expect(mockDocIntelligence.createInvoiceExtraction).toHaveBeenCalledTimes(2);
      // Email intake has no acting user; the image-group invoice sends every
      // page to the same extraction.
      const calls = mockDocIntelligence.createInvoiceExtraction.mock.calls.map((c) => c[0]);
      expect(calls[0]).toMatchObject({ createdByUserId: null, companyId: 'comp-1' });
      expect(calls[0].files).toHaveLength(1);
      expect(calls[1].files).toHaveLength(2);
      expect(calls[1].files.map((f: { mimeType: string }) => f.mimeType)).toEqual([
        'image/jpeg',
        'image/jpeg',
      ]);
    });

    it('throws when every attachment group fails, so the provider retries', async () => {
      mockFetchRoutes([attachment()], false);

      await expect(buildService().processInboundEmail(inboundEmail())).rejects.toThrow(
        /download failed/,
      );
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it('keeps partial successes and acks when at least one invoice was created', async () => {
      mockFetchRoutes([
        attachment({ id: 'att-1', filename: 'inv-a.pdf' }),
        attachment({ id: 'att-2', filename: 'inv-b.pdf' }),
      ]);
      mockPrisma.invoice.create
        .mockResolvedValueOnce({ id: 'inv-ok' })
        .mockRejectedValueOnce(new Error('db down'));

      const result = await buildService().processInboundEmail(inboundEmail());

      expect(result).toEqual({ handled: true, invoicesCreated: 1 });
    });

    it('throws when the attachments API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

      await expect(buildService().processInboundEmail(inboundEmail())).rejects.toThrow(
        /attachments API returned 500/,
      );
    });

    it('throws when RESEND_API_KEY is missing', async () => {
      await expect(
        buildService({ RESEND_API_KEY: '' }).processInboundEmail(inboundEmail()),
      ).rejects.toThrow(/RESEND_API_KEY/);
    });
  });
});
