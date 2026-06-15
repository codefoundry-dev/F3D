import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

import { DocExtractionStatus, DocExtractionType } from '../enums';

import { BasePaginationQueryDto } from './pagination.dto';

// ── Request DTOs ─────────────────────────────────────────────────────────────

/**
 * Multipart upload payload — the actual PDF arrives as a multer file; this
 * DTO carries the surrounding metadata fields submitted alongside it.
 */
export class CreateDocExtractionDto {
  @ApiProperty({ enum: DocExtractionType })
  @IsEnum(DocExtractionType)
  type!: DocExtractionType;

  @ApiPropertyOptional({
    description:
      'Free-form extraction hint. Forwarded into the Gemini prompt so callers can steer field naming.',
  })
  @IsOptional()
  @IsString()
  promptHint?: string;

  @ApiPropertyOptional({
    description:
      'For spreadsheet uploads: the worksheet names to extract. Omit to extract every sheet. ' +
      'Sent as a JSON-encoded string array in the multipart form (e.g. "[\\"HDPE\\"]").',
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }): string[] | undefined => {
    let raw: unknown = value;
    if (typeof value === 'string') {
      try {
        raw = JSON.parse(value);
      } catch {
        return undefined;
      }
    }
    if (!Array.isArray(raw)) return undefined;
    return raw.filter((entry): entry is string => typeof entry === 'string');
  })
  @IsArray()
  @IsString({ each: true })
  sheetNames?: string[];
}

export class UpdateDocExtractionDto {
  @ApiProperty({
    description: 'Edited extraction result, replaces previous edits.',
    type: Object,
  })
  @IsObject()
  editedResult!: Record<string, unknown>;
}

export class ConfirmDocExtractionDto {
  @ApiPropertyOptional({
    description: 'Final edits applied at confirmation. Replaces previous edits.',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  editedResult?: Record<string, unknown>;
}

export class DocExtractionListQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional({ enum: DocExtractionType })
  @IsOptional()
  @IsEnum(DocExtractionType)
  type?: DocExtractionType;

  @ApiPropertyOptional({ enum: DocExtractionStatus })
  @IsOptional()
  @IsEnum(DocExtractionStatus)
  status?: DocExtractionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdByUserId?: string;
}

// ── Response DTOs ────────────────────────────────────────────────────────────

export class DocExtractionFileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  filename!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  size!: number;
}

export class DocExtractionUsageDto {
  @ApiPropertyOptional()
  promptTokens!: number | null;

  @ApiPropertyOptional()
  completionTokens!: number | null;
}

export class DocExtractionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: DocExtractionType })
  type!: DocExtractionType;

  @ApiProperty({ enum: DocExtractionStatus })
  status!: DocExtractionStatus;

  @ApiProperty({ type: DocExtractionFileDto })
  @Type(() => DocExtractionFileDto)
  file!: DocExtractionFileDto;

  @ApiPropertyOptional({ type: Object })
  rawResult!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object })
  editedResult!: Record<string, unknown> | null;

  @ApiPropertyOptional()
  errorCode!: string | null;

  @ApiPropertyOptional()
  errorMessage!: string | null;

  @ApiPropertyOptional()
  model!: string | null;

  @ApiPropertyOptional({ type: DocExtractionUsageDto })
  @Type(() => DocExtractionUsageDto)
  usage!: DocExtractionUsageDto | null;

  @ApiProperty()
  createdByUserId!: string;

  @ApiPropertyOptional()
  lastEditedByUserId!: string | null;

  @ApiPropertyOptional()
  confirmedByUserId!: string | null;

  @ApiPropertyOptional()
  companyId!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiPropertyOptional()
  completedAt!: string | null;

  @ApiPropertyOptional()
  lastEditedAt!: string | null;

  @ApiPropertyOptional()
  confirmedAt!: string | null;
}
