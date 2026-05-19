import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

import { InvoiceStatus } from '../enums';

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

  @ApiProperty()
  projectName!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  vendorName!: string;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiPropertyOptional()
  relatedPo!: string | null;

  @ApiProperty()
  totalAmount!: number;

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
