import { randomUUID } from 'crypto';
import * as path from 'path';

import {
  DocExtractionItemOpDto,
  DocExtractionItemOpsResultDto,
  DocExtractionItemsQueryDto,
  DocExtractionItemsResponseDto,
  DocExtractionListQueryDto,
  DocExtractionResultSummaryDto,
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
import { OcrService } from '../ocr/ocr.service';
import { OcrError } from '../ocr/ocr.types';
import { StorageService } from '../storage/storage.service';

import { normalizeBomResult } from './doc-intelligence.bom';
import { normalizeCatalogueResult, spreadsheetToCatalogue } from './doc-intelligence.catalogue';
import { normalizeInvoiceResult } from './doc-intelligence.invoice';
import {
  annotateBomWithMatches,
  dropUnmatchedBomLines,
  type CatalogueMaterial,
} from './doc-intelligence.match';
import { buildExtractionPrompt, buildOcrTextPrompt } from './doc-intelligence.prompts';
import { normalizeQuoteResult } from './doc-intelligence.quote';
import { buildResponseSchema } from './doc-intelligence.schemas';
import { listSpreadsheetSheets, spreadsheetToText } from './doc-intelligence.spreadsheet';
import { normalizeVendorDocumentResult } from './doc-intelligence.vendor-document';

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

// FOR-259: below this many characters the OCR pass clearly failed to read the
// document (a real vendor document yields hundreds), so fall back to the LLM.
const MIN_OCR_TEXT_CHARS = 20;

/** Outcome of the OCR-first attempt on a vendor document (FOR-259). */
interface OcrOutcome {
  /** The OCR text when it was confident enough to send to the LLM; else null. */
  text: string | null;
  confidence: number | null;
  used: boolean;
}

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
  /**
   * For spreadsheet uploads: the subset of worksheet names to extract. Omit to
   * extract every sheet. Lets the BOM flow skip duplicate/scratch tabs that
   * would otherwise double up the extracted line items.
   */
  sheetNames?: string[];
}

export interface ExtractionWithFile extends DocExtraction {
  file: PrismaFile;
}

/**
 * Every scalar EXCEPT the jsonb result columns. The summary/items/ops paths use
 * this so a completed catalogue result (tens of MB) is never materialised in
 * Node — counting and slicing happen inside Postgres.
 */
const EXTRACTION_SANS_RESULTS_SELECT = {
  id: true,
  type: true,
  status: true,
  fileId: true,
  errorCode: true,
  errorMessage: true,
  model: true,
  promptTokens: true,
  completionTokens: true,
  createdByUserId: true,
  lastEditedByUserId: true,
  lastEditedAt: true,
  confirmedByUserId: true,
  companyId: true,
  rfqId: true,
  invoiceId: true,
  companyDocumentId: true,
  ocrConfidence: true,
  ocrUsed: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  confirmedAt: true,
  file: true,
} satisfies Prisma.DocExtractionSelect;

export type ExtractionMetaWithFile = Prisma.DocExtractionGetPayload<{
  select: typeof EXTRACTION_SANS_RESULTS_SELECT;
}>;

@Injectable()
export class DocIntelligenceService {
  private readonly logger = new Logger(DocIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly gemini: GeminiService,
    private readonly ocr: OcrService,
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
    void this.runExtraction(
      extraction.id,
      input.file.buffer,
      mimeType,
      input.promptHint,
      input.sheetNames,
    );

    return extraction;
  }

  // ── List spreadsheet sheets (pre-flight, no Gemini) ──────────────────────

  /**
   * List the worksheet names in an uploaded spreadsheet without persisting it or
   * calling Gemini. Drives the BOM upload's sheet picker so the user can extract
   * only the relevant tab(s). Returns an empty array for non-spreadsheet files
   * (CSV/PDF/image), which have no sheets to choose between.
   */
  async listSheets(file: Express.Multer.File): Promise<string[]> {
    if (!file) throw new BadRequestException(ERR.storage.noFileProvided);
    // Parse in-memory only — cap at the Gemini file size to bound the work
    // (a huge catalogue export could OOM the box just being parsed for names).
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(ERR.storage.fileTooLarge('10MB'));
    }
    if (!SPREADSHEET_MIME_TYPES.has(effectiveMimeType(file))) return [];
    return listSpreadsheetSheets(file.buffer);
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

  // ── Intake invoice extraction (FOR-291) ───────────────────────────────────

  /**
   * Create an INVOICE extraction for an intake invoice (FOR-290 manual upload
   * or email inbox) whose files are already persisted. Multi-file invoices
   * (several photographed pages grouped into one email-intake invoice) send
   * every page to Gemini in a single call. Email-intake invoices have no
   * creating user, so `createdByUserId` is nullable.
   *
   * Best-effort by design: when Gemini isn't configured, no job is created —
   * the review UI falls back to manual entry rather than showing a job stuck
   * in PENDING forever.
   */
  async createInvoiceExtraction(input: {
    invoiceId: string;
    companyId: string;
    createdByUserId: string | null;
    files: { fileId: string; mimeType: string; data: Buffer }[];
  }): Promise<void> {
    if (!this.gemini.isConfigured()) {
      this.logger.warn(
        `Skipping extraction for invoice ${input.invoiceId}: Gemini is not configured`,
      );
      return;
    }
    const [primary, ...rest] = input.files.filter((f) => GEMINI_NATIVE_MIME_TYPES.has(f.mimeType));
    if (!primary) return;

    const extraction = await this.prisma.docExtraction.create({
      data: {
        type: DocExtractionType.INVOICE,
        status: DocExtractionStatus.PENDING,
        fileId: primary.fileId,
        createdByUserId: input.createdByUserId,
        companyId: input.companyId,
        invoiceId: input.invoiceId,
      },
    });

    void this.runExtraction(
      extraction.id,
      primary.data,
      primary.mimeType,
      undefined,
      undefined,
      rest.map((f) => ({ mimeType: f.mimeType as GeminiMimeType, data: f.data })),
    );
  }

  // ── Vendor document extraction (FOR-259) ──────────────────────────────────

  /**
   * Create a VENDOR_DOCUMENT extraction for an uploaded company document
   * (insurance / license / certification) whose file is already persisted.
   * OCR-first: Google Vision extracts the text and the LLM structures it; the
   * multimodal LLM path is the fallback when OCR is unavailable, fails, or
   * reports low confidence (see `tryOcrFirst`).
   *
   * Best-effort like the invoice intake: when Gemini isn't configured (it is
   * needed to structure the OCR text too) or the file type has no extraction
   * path (e.g. .docx), no job is created and the upload is unaffected.
   *
   * The result is never written onto the CompanyDocument automatically: a
   * human reviews and approves the extracted values first (FOR-260), via
   * PATCH /companies/:id/documents/:docId/review.
   */
  async createVendorDocumentExtraction(input: {
    companyId: string;
    companyDocumentId: string;
    createdByUserId: string;
    fileId: string;
    mimeType: string;
    data: Buffer;
  }): Promise<void> {
    if (!this.gemini.isConfigured()) {
      this.logger.warn(
        `Skipping extraction for company document ${input.companyDocumentId}: Gemini is not configured`,
      );
      return;
    }
    if (!GEMINI_NATIVE_MIME_TYPES.has(input.mimeType)) return;

    const extraction = await this.prisma.docExtraction.create({
      data: {
        type: DocExtractionType.VENDOR_DOCUMENT,
        status: DocExtractionStatus.PENDING,
        fileId: input.fileId,
        createdByUserId: input.createdByUserId,
        companyId: input.companyId,
        companyDocumentId: input.companyDocumentId,
      },
    });

    void this.runExtraction(extraction.id, input.data, input.mimeType);
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
    sheetNames?: string[],
    // Further pages of the same document (multi-image intake invoices,
    // FOR-291); sent to Gemini in the same call as the primary file.
    extraDocuments?: { mimeType: GeminiMimeType; data: Buffer }[],
  ): Promise<void> {
    const job = await this.prisma.docExtraction.findUnique({ where: { id: extractionId } });
    if (!job) return;

    await this.prisma.docExtraction.update({
      where: { id: extractionId },
      data: { status: DocExtractionStatus.PROCESSING },
    });

    // Outside the try so the failure path can persist the OCR telemetry too.
    let ocrOutcome: OcrOutcome | null = null;

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
      // FOR-259: vendor documents go through Google OCR first; when the OCR
      // text is confident, the LLM gets a cheap text-only call instead of the
      // raw document. Low confidence / failure falls through to multimodal.
      if (job.type === DocExtractionType.VENDOR_DOCUMENT) {
        ocrOutcome = await this.tryOcrFirst(extractionId, fileBuffer, mimeType);
      }
      const inlinePrompt = ocrOutcome?.text
        ? buildOcrTextPrompt(prompt, ocrOutcome.text)
        : SPREADSHEET_MIME_TYPES.has(mimeType)
          ? await this.buildSpreadsheetPrompt(prompt, fileBuffer, sheetNames)
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
            documents: [
              { mimeType: mimeType as GeminiMimeType, data: fileBuffer },
              ...(extraDocuments ?? []),
            ],
            generationConfig,
          });

      const parsed = this.parseJson(result.text);
      const normalized = this.normalizeForType(job.type, parsed);
      // For BOMs, enrich each line with its best catalogue match + confidence
      // so the review table can show matches and flag low-confidence lines.
      // CATALOGUE (PDF/image) is normalized but NOT catalogue-matched.
      const editedResult =
        job.type === DocExtractionType.BOM
          ? await this.matchBomToCatalogue(normalized, job.companyId)
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
          ...(ocrOutcome ? { ocrConfidence: ocrOutcome.confidence, ocrUsed: ocrOutcome.used } : {}),
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
          ...(ocrOutcome ? { ocrConfidence: ocrOutcome.confidence, ocrUsed: ocrOutcome.used } : {}),
        },
      });
    }
  }

  /**
   * FOR-259: attempt Google OCR before the LLM. Never throws — any failure or
   * low-confidence result reports `used: false`, sending the raw document
   * down the existing multimodal LLM path (the acceptance criteria's
   * "LLM acts as fallback").
   */
  private async tryOcrFirst(
    extractionId: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<OcrOutcome> {
    if (!this.ocr.isConfigured() || !this.ocr.supports(mimeType)) {
      return { text: null, confidence: null, used: false };
    }
    try {
      const result = await this.ocr.extractText(fileBuffer, mimeType);
      const enoughText = result.text.trim().length >= MIN_OCR_TEXT_CHARS;
      // A null confidence (Vision omitted it) with real text is trusted; only
      // an explicit low score falls back.
      const confident =
        result.confidence === null || result.confidence >= this.ocr.confidenceThreshold;
      if (!enoughText || !confident) {
        this.logger.warn(
          `Extraction ${extractionId}: OCR ${
            enoughText
              ? `confidence ${result.confidence?.toFixed(2)} below ${this.ocr.confidenceThreshold}`
              : 'returned no usable text'
          }; falling back to the multimodal LLM`,
        );
        return { text: null, confidence: result.confidence, used: false };
      }
      return { text: result.text, confidence: result.confidence, used: true };
    } catch (err) {
      const detail = err instanceof OcrError ? `${err.code}: ${err.message}` : String(err);
      this.logger.warn(
        `Extraction ${extractionId}: OCR failed (${detail}); falling back to the multimodal LLM`,
      );
      return { text: null, confidence: null, used: false };
    }
  }

  /**
   * Gemini can't ingest spreadsheets directly, so we serialise the workbook to
   * tab-separated text and fold it into the prompt as the "attached document".
   */
  private async buildSpreadsheetPrompt(
    basePrompt: string,
    fileBuffer: Buffer,
    sheetNames?: string[],
  ): Promise<string> {
    const sheetText = await spreadsheetToText(fileBuffer, sheetNames);
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
    if (type === DocExtractionType.VENDOR_DOCUMENT) {
      return normalizeVendorDocumentResult(parsed) as unknown as Record<string, unknown>;
    }
    return parsed;
  }

  /**
   * Annotate a normalized BOM with catalogue matches + confidence scores
   * against the PUBLIC material catalogue PLUS the extraction's own company's
   * private rows (US 4.02), so a company's contributed materials are matchable
   * in its BOMs. Best-effort: any failure (DB hiccup, empty catalogue) leaves
   * the BOM unmatched rather than failing the whole extraction — the user can
   * still match lines manually in the review table.
   */
  private async matchBomToCatalogue(
    normalized: Record<string, unknown>,
    companyId: string | null,
  ): Promise<Record<string, unknown>> {
    try {
      const bom = normalized as unknown as BomExtractionResult;
      if (!Array.isArray(bom.items) || bom.items.length === 0) return normalized;

      const materials = await this.prisma.material.findMany({
        where: {
          OR: [
            { status: MaterialStatus.PUBLIC },
            // '__none__' is an unmatchable sentinel for a company-less extraction.
            { companyId: companyId ?? '__none__' },
          ],
        },
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

  // ── Summary + windowed items (large results stay server-side) ───────────

  /** Load the row minus its jsonb results, with the same visibility rules as getExtraction. */
  private async getExtractionMeta(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ExtractionMetaWithFile> {
    const job = await this.prisma.docExtraction.findUnique({
      where: { id },
      select: EXTRACTION_SANS_RESULTS_SELECT,
    });
    if (!job || !this.canAccess(job, user)) {
      throw new NotFoundException(ERR.docExtractions.notFound);
    }
    return job;
  }

  /**
   * Poll variant that never ships (or even loads) the result payload: counts
   * and the small header fields are computed inside Postgres.
   */
  async getExtractionSummary(
    id: string,
    user: AuthenticatedUser,
  ): Promise<{ job: ExtractionMetaWithFile; summary: DocExtractionResultSummaryDto }> {
    const job = await this.getExtractionMeta(id, user);
    const [row] = await this.prisma.$queryRaw<
      { item_count: number | null; source_name: string | null; notes: string | null }[]
    >`
      SELECT
        CASE WHEN jsonb_typeof(edited_result->'items') = 'array'
             THEN jsonb_array_length(edited_result->'items') END AS item_count,
        edited_result->>'sourceName' AS source_name,
        edited_result->>'notes' AS notes
      FROM doc_extractions
      WHERE id = ${id}
    `;
    return {
      job,
      summary: {
        itemCount: row?.item_count ?? null,
        sourceName: row?.source_name ?? null,
        notes: row?.notes ?? null,
      },
    };
  }

  /**
   * Window into editedResult.items, sliced by Postgres. `indexes` mode serves
   * scattered rows (e.g. the duplicate rows detect-duplicates flagged);
   * otherwise plain page/limit. `indexes` in the response are the rows'
   * absolute positions in the stored array, parallel to `items`.
   */
  async getExtractionItems(
    id: string,
    query: DocExtractionItemsQueryDto,
    user: AuthenticatedUser,
  ): Promise<DocExtractionItemsResponseDto> {
    await this.getExtractionMeta(id, user);
    const total = await this.countResultItems(this.prisma, id);

    if (query.indexes?.length) {
      const wanted = [...new Set(query.indexes)].sort((a, b) => a - b).filter((i) => i < total);
      if (wanted.length === 0) {
        return { items: [], indexes: [], meta: buildPaginationMeta(1, query.indexes.length, 0) };
      }
      const rows = await this.prisma.$queryRaw<
        { idx: number; elem: Record<string, unknown> }[]
      >(Prisma.sql`
        SELECT (t.ord - 1)::int AS idx, t.elem AS elem
        FROM doc_extractions,
             jsonb_array_elements(edited_result->'items') WITH ORDINALITY AS t(elem, ord)
        WHERE id = ${id} AND (t.ord - 1) IN (${Prisma.join(wanted)})
        ORDER BY t.ord
      `);
      return {
        items: rows.map((r) => r.elem),
        indexes: rows.map((r) => r.idx),
        meta: buildPaginationMeta(1, wanted.length, rows.length),
      };
    }

    const page = query.page ?? 1;
    const limit = query.take;
    const rows = await this.prisma.$queryRaw<{ idx: number; elem: Record<string, unknown> }[]>`
      SELECT (t.ord - 1)::int AS idx, t.elem AS elem
      FROM doc_extractions,
           jsonb_array_elements(edited_result->'items') WITH ORDINALITY AS t(elem, ord)
      WHERE id = ${id}
      ORDER BY t.ord
      OFFSET ${query.skip} LIMIT ${limit}
    `;
    return {
      items: rows.map((r) => r.elem),
      indexes: rows.map((r) => r.idx),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Apply ordered sparse row ops (update / remove / duplicate) to
   * editedResult.items entirely inside Postgres, so editing a 62k-row result
   * never round-trips the payload. Ops use the index AT THE TIME THEY APPLY —
   * a remove shifts later rows left, a duplicate shifts them right — and run
   * under a row lock so concurrent flushes serialise.
   */
  async applyExtractionItemOps(
    id: string,
    ops: DocExtractionItemOpDto[],
    user: AuthenticatedUser,
  ): Promise<DocExtractionItemOpsResultDto> {
    const job = await this.getExtractionMeta(id, user);
    if (
      job.status !== DocExtractionStatus.COMPLETED &&
      job.status !== DocExtractionStatus.CONFIRMED
    ) {
      throw new BadRequestException(ERR.docExtractions.notReadyForEdit);
    }

    return this.prisma.$transaction(
      async (tx) => {
        const [lockRow] = await tx.$queryRaw<{ total: number | null }[]>`
          SELECT CASE WHEN jsonb_typeof(edited_result->'items') = 'array'
                      THEN jsonb_array_length(edited_result->'items') END AS total
          FROM doc_extractions
          WHERE id = ${id}
          FOR UPDATE
        `;
        let count = lockRow?.total ?? null;
        if (count === null) {
          throw new BadRequestException(ERR.docExtractions.notReadyForEdit);
        }

        for (const op of ops) {
          if (op.index >= count) {
            throw new BadRequestException(
              `Item op index ${op.index} is out of bounds (${count} items)`,
            );
          }
          if (op.op === 'update') {
            if (!op.item) {
              throw new BadRequestException("An 'update' item op requires an item body");
            }
            await tx.$executeRaw`
              UPDATE doc_extractions
              SET edited_result = jsonb_set(
                edited_result, ARRAY['items', ${String(op.index)}],
                ${JSON.stringify(op.item)}::jsonb, false)
              WHERE id = ${id}
            `;
          } else if (op.op === 'remove') {
            await tx.$executeRaw`
              UPDATE doc_extractions
              SET edited_result = edited_result #- ARRAY['items', ${String(op.index)}]
              WHERE id = ${id}
            `;
            count -= 1;
          } else {
            await tx.$executeRaw`
              UPDATE doc_extractions
              SET edited_result = jsonb_insert(
                edited_result, ARRAY['items', ${String(op.index)}],
                edited_result->'items'->(${op.index}::int), true)
              WHERE id = ${id}
            `;
            count += 1;
          }
        }

        await tx.docExtraction.update({
          where: { id },
          data: { lastEditedByUserId: user.id, lastEditedAt: new Date() },
          select: { id: true },
        });
        return { itemCount: count };
      },
      // Each op rewrites the whole jsonb value (~50MB for a real catalogue);
      // the default 5s interactive-transaction budget is too tight for a batch.
      { timeout: 60_000 },
    );
  }

  private async countResultItems(
    db: Pick<PrismaService, '$queryRaw'>,
    id: string,
  ): Promise<number> {
    const [row] = await db.$queryRaw<{ total: number | null }[]>`
      SELECT CASE WHEN jsonb_typeof(edited_result->'items') = 'array'
                  THEN jsonb_array_length(edited_result->'items') END AS total
      FROM doc_extractions
      WHERE id = ${id}
    `;
    return row?.total ?? 0;
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

  private canAccess(
    job: Pick<DocExtraction, 'createdByUserId' | 'companyId'>,
    user: AuthenticatedUser,
  ): boolean {
    if (user.role === 'SUPER_ADMIN') return true;
    if (job.createdByUserId === user.id) return true;
    if (job.companyId && user.companyId && job.companyId === user.companyId) return true;
    return false;
  }
}
