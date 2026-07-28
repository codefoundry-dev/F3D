import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
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

/** One billed line as confirmed/corrected by the reviewer (FOR-291). */
export class ReviewInvoiceLineDto {
  /** The invoice's own printed line number / line item ID, when it has one. */
  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  lineId?: string | null;

  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  quantity?: number | null;

  @ApiPropertyOptional({ maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  unitPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lineTotal?: number | null;
}

/**
 * The reviewer's confirmed/corrected invoice fields (FOR-291). Replace
 * semantics: every save writes the full set of reviewed fields — an omitted or
 * null field means "not identified on this invoice" — and `lines` replaces the
 * invoice's line items wholesale.
 */
export class ReviewInvoiceDto {
  @ApiPropertyOptional({ description: 'The vendor (company id) the invoice is from' })
  @IsOptional()
  @IsUUID()
  vendorId?: string | null;

  @ApiPropertyOptional({ description: 'The project the invoice bills against' })
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  /**
   * The purchase order the invoice bills against (FOR-293). Prefilled by the
   * invoice↔PO reconciler's suggestion; saving persists the reviewer's
   * confirmed link.
   */
  @ApiPropertyOptional({ description: 'The purchase order (id) the invoice bills against' })
  @IsOptional()
  @IsUUID()
  relatedPoId?: string | null;

  @ApiPropertyOptional({ maxLength: 100, description: "The vendor's own invoice number" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNumber?: string | null;

  @ApiPropertyOptional({ description: 'Invoice issue date (ISO)' })
  @IsOptional()
  @IsDateString()
  issuedDate?: string | null;

  @ApiPropertyOptional({ description: 'Payment due date (ISO)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  // Unbounded: credit/adjustment notes carry negative totals.
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalAmount?: number | null;

  @ApiProperty({ type: [ReviewInvoiceLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewInvoiceLineDto)
  lines!: ReviewInvoiceLineDto[];
}

export class RejectInvoiceDto {
  /**
   * Why the invoice was rejected / what the discrepancy is (US 8.05 / 8.06).
   * Persisted on the invoice and included in the vendor's rejection email as the
   * user comment, so it must survive the request that set it. Also recorded on
   * the audit trail (FOR-294).
   */
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class ApproveInvoiceDto {
  /**
   * Optional note explaining the approval (FOR-294). Not persisted on the
   * invoice row — it lives on the audit trail entry for the transition.
   */
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
