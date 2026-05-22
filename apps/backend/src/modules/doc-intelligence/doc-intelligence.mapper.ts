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
    rawResult: (job.rawResult as Record<string, unknown> | null) ?? null,
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
    companyId: job.companyId,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    confirmedAt: job.confirmedAt ? job.confirmedAt.toISOString() : null,
  };
}
