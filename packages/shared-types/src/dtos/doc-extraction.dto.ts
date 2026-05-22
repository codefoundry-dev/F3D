import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

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
  companyId!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiPropertyOptional()
  completedAt!: string | null;

  @ApiPropertyOptional()
  confirmedAt!: string | null;
}
