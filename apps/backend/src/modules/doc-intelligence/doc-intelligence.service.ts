import { randomUUID } from 'crypto';
import * as path from 'path';

import {
  DocExtractionListQueryDto,
  buildPaginationMeta,
} from '@forethread/shared-types';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DocExtractionStatus,
  DocExtractionType,
  Prisma,
  type DocExtraction,
  type File as PrismaFile,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { GeminiError } from '../gemini/gemini.types';
import { StorageService } from '../storage/storage.service';

import { normalizeBomResult } from './doc-intelligence.bom';
import { buildExtractionPrompt } from './doc-intelligence.prompts';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export interface CreateExtractionInput {
  type: DocExtractionType;
  promptHint?: string;
  file: Express.Multer.File;
}

interface ExtractionWithFile extends DocExtraction {
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
   * Persist the uploaded PDF/image, create a PENDING extraction record, and
   * kick off the Gemini call asynchronously. The HTTP request returns as soon
   * as the record is created so the client can poll for status.
   */
  async createExtraction(
    input: CreateExtractionInput,
    user: AuthenticatedUser,
  ): Promise<ExtractionWithFile> {
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
    void this.runExtraction(extraction.id, input.file.buffer, input.file.mimetype, input.promptHint);

    return extraction;
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
      const prompt = buildExtractionPrompt(job.type, promptHint);
      const result = await this.gemini.generate({
        prompt,
        documents: [{ mimeType: mimeType as 'application/pdf', data: fileBuffer }],
        generationConfig: { responseMimeType: 'application/json' },
      });

      const parsed = this.parseJson(result.text);
      const normalized = this.normalizeForType(job.type, parsed);

      await this.prisma.docExtraction.update({
        where: { id: extractionId },
        data: {
          status: DocExtractionStatus.COMPLETED,
          rawResult: parsed as Prisma.InputJsonValue,
          editedResult: normalized as Prisma.InputJsonValue,
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

  private normalizeForType(
    type: DocExtractionType,
    parsed: Record<string, unknown>,
  ): Record<string, unknown> {
    if (type === DocExtractionType.BOM) {
      return normalizeBomResult(parsed) as unknown as Record<string, unknown>;
    }
    return parsed;
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
    return this.prisma.docExtraction.update({
      where: { id },
      data: {
        status: DocExtractionStatus.CONFIRMED,
        confirmedAt: now,
        confirmedByUserId: user.id,
        ...(editedResult
          ? {
              editedResult: editedResult as Prisma.InputJsonValue,
              lastEditedByUserId: user.id,
              lastEditedAt: now,
            }
          : {}),
      },
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
