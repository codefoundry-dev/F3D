import {
  DocExtractionResponseDto,
  DocExtractionStatus,
  DocExtractionType,
} from '@forethread/shared-types';
import type { DocExtraction, File as PrismaFile } from '@prisma/client';

type ExtractionWithFile = DocExtraction & { file: PrismaFile };

export function toExtractionResponse(job: ExtractionWithFile): DocExtractionResponseDto {
  return {
    id: job.id,
    type: job.type as DocExtractionType,
    status: job.status as DocExtractionStatus,
    file: {
      id: job.file.id,
      filename: job.file.filename,
      mimeType: job.file.mimeType,
      size: job.file.size,
    },
    // A CATALOGUE result can be tens of MB (a real export is ~62k rows). The
    // catalogue UI only ever reads editedResult, so never ship the (duplicate)
    // rawResult for catalogue — it doubles the response and OOMs the backend
    // serialising it. Other types (BOM/QUOTE) keep rawResult unchanged.
    rawResult:
      (job.type as DocExtractionType) === DocExtractionType.CATALOGUE
        ? null
        : ((job.rawResult as Record<string, unknown> | null) ?? null),
    editedResult: (job.editedResult as Record<string, unknown> | null) ?? null,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    model: job.model,
    usage:
      job.promptTokens === null && job.completionTokens === null
        ? null
        : {
            promptTokens: job.promptTokens,
            completionTokens: job.completionTokens,
          },
    createdByUserId: job.createdByUserId,
    lastEditedByUserId: job.lastEditedByUserId,
    confirmedByUserId: job.confirmedByUserId,
    companyId: job.companyId,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    lastEditedAt: job.lastEditedAt ? job.lastEditedAt.toISOString() : null,
    confirmedAt: job.confirmedAt ? job.confirmedAt.toISOString() : null,
  };
}
