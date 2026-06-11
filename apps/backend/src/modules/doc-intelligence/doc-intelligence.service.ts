import { randomUUID } from 'crypto';
import * as path from 'path';

import {
  DocExtractionListQueryDto,
  EMPTY_BOM_RESULT,
  buildPaginationMeta,
  type BomExtractionResult,
} from '@forethread/shared-types';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DocExtractionStatus,
  DocExtractionType,
  MaterialStatus,
  Prisma,
  type DocExtraction,
  type File as PrismaFile,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { GeminiError, type GeminiMimeType } from '../gemini/gemini.types';
import { StorageService } from '../storage/storage.service';

import { normalizeBomResult } from './doc-intelligence.bom';
import { normalizeCatalogueResult, spreadsheetToCatalogue } from './doc-intelligence.catalogue';
import { normalizeInvoiceResult } from './doc-intelligence.invoice';
import {
  annotateBomWithMatches,
  dropUnmatchedBomLines,
  type CatalogueMaterial,
} from './doc-intelligence.match';
import { buildExtractionPrompt } from './doc-intelligence.prompts';
import { normalizeQuoteResult } from './doc-intelligence.quote';
import { buildResponseSchema } from './doc-intelligence.schemas';
import { spreadsheetToText } from './doc-intelligence.spreadsheet';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
// Catalogue spreadsheets are large (a real Rexel export is ~11.7 MB / 62k rows);
// they are parsed directly (no Gemini), so a higher cap is safe.
const CATALOGUE_MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB

// Gemini's document API understands these natively — they are sent as inline data.
const GEMINI_NATIVE_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

// Spreadsheets can't be attached to Gemini directly, so we parse them to text
// and fold the contents into the prompt. Only the OpenXML (.xlsx) format is
// supported — exceljs cannot read the legacy binary .xls format.
const SPREADSHEET_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

// A CSV is already plain text, so its contents are folded into the prompt
// verbatim (US 5.01 — BOM uploads accept CSV).
const CSV_MIME_TYPES: ReadonlySet<string> = new Set(['text/csv']);

const ACCEPTED_MIME_TYPES: ReadonlySet<string> = new Set([
  ...GEMINI_NATIVE_MIME_TYPES,
  ...SPREADSHEET_MIME_TYPES,
  ...CSV_MIME_TYPES,
]);

/**
 * Browsers (notably on Windows) report `.csv` files as
 * `application/vnd.ms-excel` or `text/plain`, so the declared mimetype alone
 * would reject them. Key CSVs off the filename extension instead.
 */
function effectiveMimeType(file: Express.Multer.File): string {
  if (/\.csv$/iu.test(file.originalname ?? '')) return 'text/csv';
  return file.mimetype;
}

export interface CreateExtractionInput {
  type: DocExtractionType;
  promptHint?: string;
  file: Express.Multer.File;
}

export interface ExtractionWithFile extends DocExtraction {
  file: PrismaFile;
}

@Injectable()
export class DocIntelligenceService {
  private readonly logger = new Logger(DocIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly gemini: GeminiService,
  ) {}

  // ── Create extraction ────────────────────────────────────────────────────

  /**
   * Persist the uploaded PDF/image/spreadsheet, create a PENDING extraction
   * record, and kick off the Gemini call asynchronously. The HTTP request
   * returns as soon as the record is created so the client can poll for status.
   */
  async createExtraction(
    input: CreateExtractionInput,
    user: AuthenticatedUser,
  ): Promise<ExtractionWithFile> {
    if (!input.file) throw new BadRequestException(ERR.storage.noFileProvided);
    const mimeType = effectiveMimeType(input.file);
    if (!ACCEPTED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException(ERR.storage.fileTypeNotAllowed);
    }

    // A catalogue spreadsheet is parsed directly (no Gemini), so it gets a
    // higher size cap and does NOT require Gemini to be configured.
    const directParse = this.isDirectCatalogueParse(input.type, mimeType);
    const sizeLimit = directParse ? CATALOGUE_MAX_FILE_SIZE : MAX_FILE_SIZE;
    if (input.file.size > sizeLimit) {
      throw new BadRequestException(ERR.storage.fileTooLarge(directParse ? '30MB' : '10MB'));
    }
    if (!directParse && !this.gemini.isConfigured()) {
      throw new BadRequestException(ERR.docExtractions.geminiNotConfigured);
    }

    const ext = path.extname(input.file.originalname) || '';
    const key = `doc-extractions/${randomUUID()}${ext}`;

    const uploaded = await this.storage.upload(key, input.file.buffer, input.file.mimetype);

    const fileRecord = await this.prisma.file.create({
      data: {
        bucket: uploaded.bucket,
        key: uploaded.key,
        filename: input.file.originalname,
        mimeType,
        size: input.file.size,
        uploadedById: user.id,
      },
    });

    const extraction = await this.prisma.docExtraction.create({
      data: {
        type: input.type,
        status: DocExtractionStatus.PENDING,
        fileId: fileRecord.id,
        createdByUserId: user.id,
        companyId: user.companyId ?? null,
      },
      include: { file: true },
    });

    // Fire-and-forget the actual extraction.
    void this.runExtraction(extraction.id, input.file.buffer, mimeType, input.promptHint);

    return extraction;
  }

  // ── Guest quote extraction (tokenized vendor portal, FOR-206) ─────────────

  /**
   * Create a QUOTE extraction for a guest vendor who uploaded their quote PDF
   * through the tokenized RFQ portal. There is no authenticated user, so — as
   * with the guest audit-log entries — the upload and extraction are attributed
   * to the RFQ creator, and the job is tagged with `rfqId` so the public poll
   * endpoint can be scoped to guest quote jobs only.
   *
   * The caller (RFQ service) is responsible for validating the invitation token
   * before invoking this.
   */
  async createGuestQuoteExtraction(input: {
    file: Express.Multer.File;
    rfqId: string;
    attributedUserId: string;
    companyId: string | null;
  }): Promise<ExtractionWithFile> {
    if (!input.file) throw new BadRequestException(ERR.storage.noFileProvided);
    if (input.file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(ERR.storage.fileTooLarge('10MB'));
    }
    if (!ACCEPTED_MIME_TYPES.has(input.file.mimetype)) {
      throw new BadRequestException(ERR.storage.fileTypeNotAllowed);
    }
    if (!this.gemini.isConfigured()) {
      throw new BadRequestException(ERR.docExtractions.geminiNotConfigured);
    }

    const ext = path.extname(input.file.originalname) || '';
    const key = `doc-extractions/${randomUUID()}${ext}`;
    const uploaded = await this.storage.upload(key, input.file.buffer, input.file.mimetype);

    const fileRecord = await this.prisma.file.create({
      data: {
        bucket: uploaded.bucket,
        key: uploaded.key,
        filename: input.file.originalname,
        mimeType: input.file.mimetype,
        size: input.file.size,
        uploadedById: input.attributedUserId,
      },
    });

    const extraction = await this.prisma.docExtraction.create({
      data: {
        type: DocExtractionType.QUOTE,
        status: DocExtractionStatus.PENDING,
        fileId: fileRecord.id,
        createdByUserId: input.attributedUserId,
        companyId: input.companyId,
        rfqId: input.rfqId,
      },
      include: { file: true },
    });

    void this.runExtraction(extraction.id, input.file.buffer, input.file.mimetype);

    return extraction;
  }

  /**
   * Fetch a guest quote extraction for the public poll endpoint. Scoped to
   * QUOTE jobs created via the vendor portal (`rfqId` set) so the token-less,
   * UUID-addressed poll can never expose internal BOM/invoice extractions.
   */
  async getGuestQuoteExtraction(id: string): Promise<ExtractionWithFile> {
    const job = await this.prisma.docExtraction.findFirst({
      where: { id, type: DocExtractionType.QUOTE, rfqId: { not: null } },
      include: { file: true },
    });
    if (!job) throw new NotFoundException(ERR.docExtractions.notFound);
    return job;
  }

  // ── Run extraction (async) ──────────────────────────────────────────────

  /**
   * Called asynchronously after `createExtraction`. Public so tests can await
   * it directly, but in production it should never be awaited from a request
   * handler.
   */
  async runExtraction(
    extractionId: string,
    fileBuffer: Buffer,
    mimeType: string,
    promptHint?: string,
  ): Promise<void> {
    const job = await this.prisma.docExtraction.findUnique({ where: { id: extractionId } });
    if (!job) return;

    await this.prisma.docExtraction.update({
      where: { id: extractionId },
      data: { status: DocExtractionStatus.PROCESSING },
    });

    try {
      // ── Catalogue spreadsheet: parse Excel directly, no Gemini ──────────────
      if (this.isDirectCatalogueParse(job.type, mimeType)) {
        const result = await spreadsheetToCatalogue(fileBuffer);
        await this.prisma.docExtraction.update({
          where: { id: extractionId },
          data: {
            status: DocExtractionStatus.COMPLETED,
            // A catalogue spreadsheet is parsed directly into editedResult.
            // Storing the same multi-MB, 62k-row object AGAIN as rawResult only
            // doubles the GET payload (~76 MB) and OOMs the box serialising it.
            // editedResult is the single source of truth for catalogue, so leave
            // rawResult null. (Catalogue PDFs/images still go through Gemini below
            // and keep their raw Gemini output.)
            rawResult: Prisma.DbNull,
            editedResult: result as unknown as Prisma.InputJsonValue,
            model: null,
            promptTokens: null,
            completionTokens: null,
            completedAt: new Date(),
          },
        });
        return;
      }

      const prompt = buildExtractionPrompt(job.type, promptHint);
      // temperature 0 + responseSchema (constrained decoding) make the output
      // deterministic and guarantee the canonical keys/shape for typed jobs;
      // GENERIC has no schema and stays on plain JSON mode.
      const responseSchema = buildResponseSchema(job.type);
      const generationConfig = {
        temperature: 0,
        responseMimeType: 'application/json' as const,
        ...(responseSchema ? { responseSchema } : {}),
      };
      const inlinePrompt = SPREADSHEET_MIME_TYPES.has(mimeType)
        ? await this.buildSpreadsheetPrompt(prompt, fileBuffer)
        : CSV_MIME_TYPES.has(mimeType)
          ? this.buildCsvPrompt(prompt, fileBuffer)
          : null;
      const result = inlinePrompt
        ? await this.gemini.generate({
            prompt: inlinePrompt,
            generationConfig,
          })
        : await this.gemini.generate({
            prompt,
            documents: [{ mimeType: mimeType as GeminiMimeType, data: fileBuffer }],
            generationConfig,
          });

      const parsed = this.parseJson(result.text);
      const normalized = this.normalizeForType(job.type, parsed);
      // For BOMs, enrich each line with its best catalogue match + confidence
      // so the review table can show matches and flag low-confidence lines.
      // CATALOGUE (PDF/image) is normalized but NOT catalogue-matched.
      const editedResult =
        job.type === DocExtractionType.BOM
          ? await this.matchBomToCatalogue(normalized)
          : normalized;

      await this.prisma.docExtraction.update({
        where: { id: extractionId },
        data: {
          status: DocExtractionStatus.COMPLETED,
          rawResult: parsed as Prisma.InputJsonValue,
          editedResult: editedResult as Prisma.InputJsonValue,
          model: result.model,
          promptTokens: result.usage?.promptTokenCount ?? null,
          completionTokens: result.usage?.candidatesTokenCount ?? null,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      const { code, message } = this.mapError(err);
      this.logger.warn(`Extraction ${extractionId} failed (${code}): ${message}`);
      await this.prisma.docExtraction.update({
        where: { id: extractionId },
        data: {
          status: DocExtractionStatus.FAILED,
          errorCode: code,
          errorMessage: message,
          completedAt: new Date(),
        },
      });
    }
  }

  /**
   * Gemini can't ingest spreadsheets directly, so we serialise the workbook to
   * tab-separated text and fold it into the prompt as the "attached document".
   */
  private async buildSpreadsheetPrompt(basePrompt: string, fileBuffer: Buffer): Promise<string> {
    const sheetText = await spreadsheetToText(fileBuffer);
    return `${basePrompt}

The document is a spreadsheet, provided below as tab-separated values. Each "# Sheet:" line starts a new worksheet. Treat the rows below as the attached document.

${sheetText}`;
  }

  /** A CSV is already text — fold it into the prompt verbatim. */
  private buildCsvPrompt(basePrompt: string, fileBuffer: Buffer): string {
    return `${basePrompt}

The document is a CSV file, provided below verbatim. Treat the rows below as the attached document.

${fileBuffer.toString('utf-8')}`;
  }

  /**
   * True when this job is a catalogue spreadsheet — the one path that parses
   * Excel directly (no Gemini). Catalogue PDFs/images still go through Gemini,
   * and BOM/QUOTE spreadsheets are unchanged.
   */
  private isDirectCatalogueParse(type: DocExtractionType, mimeType: string): boolean {
    return type === DocExtractionType.CATALOGUE && SPREADSHEET_MIME_TYPES.has(mimeType);
  }

  private normalizeForType(
    type: DocExtractionType,
    parsed: Record<string, unknown>,
  ): Record<string, unknown> {
    if (type === DocExtractionType.BOM) {
      return normalizeBomResult(parsed) as unknown as Record<string, unknown>;
    }
    if (type === DocExtractionType.QUOTE) {
      return normalizeQuoteResult(parsed) as unknown as Record<string, unknown>;
    }
    if (type === DocExtractionType.CATALOGUE) {
      return normalizeCatalogueResult(parsed) as unknown as Record<string, unknown>;
    }
    if (type === DocExtractionType.INVOICE) {
      return normalizeInvoiceResult(parsed) as unknown as Record<string, unknown>;
    }
    return parsed;
  }

  /**
   * Annotate a normalized BOM with catalogue matches + confidence scores
   * against the PUBLIC material catalogue. Best-effort: any failure (DB hiccup,
   * empty catalogue) leaves the BOM unmatched rather than failing the whole
   * extraction — the user can still match lines manually in the review table.
   */
  private async matchBomToCatalogue(
    normalized: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    try {
      const bom = normalized as unknown as BomExtractionResult;
      if (!Array.isArray(bom.items) || bom.items.length === 0) return normalized;

      const materials = await this.prisma.material.findMany({
        where: { status: MaterialStatus.PUBLIC },
        select: {
          id: true,
          name: true,
          uom: true,
          subCategory: true,
          description: true,
          category: { select: { name: true } },
        },
      });
      if (materials.length === 0) return normalized;

      // Carry the catalogue attributes the review row + match-picker render onto
      // each candidate (category name flattened from the relation).
      const catalogue: CatalogueMaterial[] = materials.map((m) => ({
        id: m.id,
        name: m.name,
        uom: m.uom,
        subCategory: m.subCategory,
        description: m.description,
        category: m.category?.name,
      }));
      return annotateBomWithMatches(bom, catalogue) as unknown as Record<string, unknown>;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.warn(`BOM catalogue matching skipped: ${message}`);
      return normalized;
    }
  }

  private parseJson(raw: string): Record<string, unknown> {
    const trimmed = this.stripCodeFence(raw.trim());
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { value: parsed };
    } catch {
      throw new GeminiError('MALFORMED_RESPONSE', 'Gemini returned non-JSON content');
    }
  }

  private stripCodeFence(raw: string): string {
    if (!raw.startsWith('```')) return raw;
    const withoutOpen = raw.replace(/^```(?:json)?\s*/i, '');
    return withoutOpen.replace(/```\s*$/i, '').trim();
  }

  private mapError(err: unknown): { code: string; message: string } {
    if (err instanceof GeminiError) {
      return { code: err.code, message: err.message };
    }
    if (err instanceof Error) {
      return { code: 'UNKNOWN', message: err.message };
    }
    return { code: 'UNKNOWN', message: 'Unknown extraction failure' };
  }

  // ── Read / list ──────────────────────────────────────────────────────────

  async getExtraction(id: string, user: AuthenticatedUser): Promise<ExtractionWithFile> {
    const job = await this.prisma.docExtraction.findUnique({
      where: { id },
      include: { file: true },
    });
    if (!job || !this.canAccess(job, user)) {
      throw new NotFoundException(ERR.docExtractions.notFound);
    }
    return job;
  }

  async listExtractions(query: DocExtractionListQueryDto, user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.DocExtractionWhereInput = {};

    if (user.role !== 'SUPER_ADMIN') {
      // Scope by company when present, else by creator (e.g. vendors)
      if (user.companyId) {
        where.OR = [{ companyId: user.companyId }, { createdByUserId: user.id }];
      } else {
        where.createdByUserId = user.id;
      }
    }
    if (query.type) where.type = query.type as DocExtractionType;
    if (query.status) where.status = query.status as DocExtractionStatus;
    if (query.createdByUserId) where.createdByUserId = query.createdByUserId;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.docExtraction.findMany({
        where,
        include: { file: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.docExtraction.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  // ── Edit / confirm / delete ─────────────────────────────────────────────

  async updateExtraction(
    id: string,
    editedResult: Record<string, unknown>,
    user: AuthenticatedUser,
  ): Promise<ExtractionWithFile> {
    const job = await this.getExtraction(id, user);
    if (
      job.status !== DocExtractionStatus.COMPLETED &&
      job.status !== DocExtractionStatus.CONFIRMED
    ) {
      throw new BadRequestException(ERR.docExtractions.notReadyForEdit);
    }
    return this.prisma.docExtraction.update({
      where: { id },
      data: {
        editedResult: editedResult as Prisma.InputJsonValue,
        lastEditedByUserId: user.id,
        lastEditedAt: new Date(),
      },
      include: { file: true },
    });
  }

  async confirmExtraction(
    id: string,
    editedResult: Record<string, unknown> | undefined,
    user: AuthenticatedUser,
  ): Promise<ExtractionWithFile> {
    const job = await this.getExtraction(id, user);
    if (job.status === DocExtractionStatus.CONFIRMED) {
      throw new BadRequestException(ERR.docExtractions.alreadyConfirmed);
    }
    if (job.status !== DocExtractionStatus.COMPLETED) {
      throw new BadRequestException(ERR.docExtractions.notReadyForConfirm);
    }
    const now = new Date();
    const userEdited = editedResult !== undefined;

    // Confirming is the "proceed" gate for a BOM. By now the obvious lines were
    // auto-matched at extraction and the user has had the review table to match
    // the rest, so any line STILL unmatched is dropped before the BOM moves into
    // the RFQ builder. The pruned result is always persisted — even when the user
    // made no manual edits — so the confirmed BOM never carries unmatched lines.
    const data: Prisma.DocExtractionUncheckedUpdateInput = {
      status: DocExtractionStatus.CONFIRMED,
      confirmedAt: now,
      confirmedByUserId: user.id,
    };
    if (job.type === DocExtractionType.BOM) {
      const source = (editedResult ??
        job.editedResult ??
        EMPTY_BOM_RESULT) as unknown as BomExtractionResult;
      data.editedResult = dropUnmatchedBomLines(source) as unknown as Prisma.InputJsonValue;
      // The unmatched-line drop is a system step; attribute a "last edit" to the
      // user only when they actually submitted changes in the review table.
      if (userEdited) {
        data.lastEditedByUserId = user.id;
        data.lastEditedAt = now;
      }
    } else if (editedResult) {
      data.editedResult = editedResult as Prisma.InputJsonValue;
      data.lastEditedByUserId = user.id;
      data.lastEditedAt = now;
    }

    return this.prisma.docExtraction.update({
      where: { id },
      data,
      include: { file: true },
    });
  }

  async deleteExtraction(id: string, user: AuthenticatedUser): Promise<void> {
    const job = await this.getExtraction(id, user);
    await this.prisma.docExtraction.delete({ where: { id: job.id } });
    await this.storage.delete(job.file.key).catch(() => undefined);
    await this.prisma.file.delete({ where: { id: job.fileId } }).catch(() => undefined);
  }

  // ── Access control ──────────────────────────────────────────────────────

  private canAccess(job: DocExtraction, user: AuthenticatedUser): boolean {
    if (user.role === 'SUPER_ADMIN') return true;
    if (job.createdByUserId === user.id) return true;
    if (job.companyId && user.companyId && job.companyId === user.companyId) return true;
    return false;
  }
}
