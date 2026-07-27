import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

import { DocExtractionStatus, DocExtractionType } from '../enums';

import { BasePaginationQueryDto, PaginationMetaDto } from './pagination.dto';

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

export class DocExtractionGetQueryDto {
  @ApiPropertyOptional({
    enum: ['full', 'summary'],
    description:
      "'summary' omits raw/edited results and returns resultSummary instead — the poll " +
      'stays tiny even when the completed result is tens of MB (a 62k-row catalogue).',
  })
  @IsOptional()
  @IsIn(['full', 'summary'])
  resultView?: 'full' | 'summary';
}

/** Window query for GET /doc-extractions/:id/items. */
export class DocExtractionItemsQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Comma-separated absolute item indexes to fetch instead of a page (max 500) — e.g. ' +
      'the duplicate rows surfaced by detect-duplicates. Overrides page/limit.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }): number[] | undefined => {
    if (typeof value !== 'string' || value.trim() === '') return undefined;
    return value.split(',').map((part) => Number(part.trim()));
  })
  @IsArray()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(0, { each: true })
  indexes?: number[];
}

/** One ordered mutation of the stored result's items array. */
export class DocExtractionItemOpDto {
  @ApiProperty({ enum: ['update', 'remove', 'duplicate'] })
  @IsIn(['update', 'remove', 'duplicate'])
  op!: 'update' | 'remove' | 'duplicate';

  /** Absolute index into the items array AT THE TIME THIS OP APPLIES (ops shift indexes). */
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  index!: number;

  /** Full replacement row — required for 'update', ignored otherwise. */
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  item?: Record<string, unknown>;
}

/**
 * Sparse row edits for PATCH /doc-extractions/:id/items. Applied in order,
 * server-side, so a large result is never round-tripped through the client.
 */
export class ApplyDocExtractionItemOpsDto {
  @ApiProperty({ type: [DocExtractionItemOpDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DocExtractionItemOpDto)
  ops!: DocExtractionItemOpDto[];
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

/** Lightweight stand-in for the result payload under resultView=summary. */
export class DocExtractionResultSummaryDto {
  /** Length of the result's items array; null when the result has no items array. */
  @ApiPropertyOptional()
  itemCount!: number | null;

  @ApiPropertyOptional()
  sourceName!: string | null;

  @ApiPropertyOptional()
  notes!: string | null;
}

/** Response for GET /doc-extractions/:id/items. */
export class DocExtractionItemsResponseDto {
  @ApiProperty({ type: [Object] })
  items!: Record<string, unknown>[];

  /** Absolute index of each row in `items` (parallel arrays) — never infer from page math. */
  @ApiProperty({ type: [Number] })
  indexes!: number[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

/** Response for PATCH /doc-extractions/:id/items. */
export class DocExtractionItemOpsResultDto {
  /** Items array length after the ops applied. */
  @ApiProperty()
  itemCount!: number;
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

  /** Present (and results null) when the job was fetched with resultView=summary. */
  @ApiPropertyOptional({ type: DocExtractionResultSummaryDto })
  @Type(() => DocExtractionResultSummaryDto)
  resultSummary?: DocExtractionResultSummaryDto | null;

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
