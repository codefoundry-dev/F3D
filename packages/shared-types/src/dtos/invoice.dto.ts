import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { InvoiceSource, InvoiceStatus } from '../enums';

import { BasePaginationQueryDto, PaginationMetaDto } from './pagination.dto';

// ── Request DTOs ─────────────────────────────────────────────────────────────

export class InvoiceListQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  vendorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dueDateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dueDateTo?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  amountMin?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  amountMax?: number;

  @ApiPropertyOptional({
    enum: ['id', 'projectName', 'vendorName', 'status', 'totalAmount', 'dueDate'],
  })
  @IsString()
  @IsOptional()
  sortBy?: string = 'dueDate';

  @ApiPropertyOptional({ description: 'Comma-separated invoice IDs to filter by' })
  @IsString()
  @IsOptional()
  ids?: string;
}

// ── Response DTOs ────────────────────────────────────────────────────────────

export class InvoiceListItemDto {
  @ApiProperty()
  id!: string;

  // project/vendor/totalAmount are null on intake-created invoices that
  // haven't been reviewed yet (FOR-290).
  @ApiPropertyOptional()
  projectName!: string | null;

  @ApiPropertyOptional()
  projectId!: string | null;

  @ApiPropertyOptional()
  vendorName!: string | null;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiProperty({ enum: InvoiceSource })
  source!: InvoiceSource;

  @ApiPropertyOptional()
  relatedPo!: string | null;

  @ApiPropertyOptional()
  totalAmount!: number | null;

  @ApiPropertyOptional()
  dueDate!: string | null;
}

export class PaginatedInvoicesResponseDto {
  @ApiProperty({ type: [InvoiceListItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceListItemDto)
  items!: InvoiceListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  @ValidateNested()
  @Type(() => PaginationMetaDto)
  meta!: PaginationMetaDto;
}

// ── Action DTOs ──────────────────────────────────────────────────────────────

export class BulkApproveInvoicesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  ids!: string[];
}

export class RejectInvoiceDto {
  /**
   * Why the invoice was rejected / what the discrepancy is (US 8.05 / 8.06).
   * Persisted on the invoice and included in the vendor's rejection email as the
   * user comment, so it must survive the request that set it.
   */
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
