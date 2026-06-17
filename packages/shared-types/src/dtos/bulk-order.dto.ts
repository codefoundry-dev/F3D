import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

import { BasePaginationQueryDto, PaginationMetaDto } from './pagination.dto';

// ── Request DTOs ─────────────────────────────────────────────────────────────

export class BulkOrderListQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  vendorId?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'EXPIRED', 'FULLY_DRAWN'] })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    enum: ['id', 'projectName', 'vendorName', 'totalAmount', 'date'],
  })
  @IsString()
  @IsOptional()
  sortBy?: string = 'date';
}

// ── Response DTOs ────────────────────────────────────────────────────────────

export class BulkOrderListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  projectName!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  vendorId!: string;

  @ApiProperty()
  vendorName!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  brands!: string | null;

  @ApiProperty()
  lineItems!: number;

  @ApiProperty()
  deliveriesPercent!: number;

  @ApiProperty()
  amountCount!: number;

  @ApiProperty()
  totalAmount!: number;

  @ApiPropertyOptional()
  solidGold!: string | null;

  @ApiProperty()
  date!: string;

  @ApiPropertyOptional()
  validUntil!: string | null;

  @ApiPropertyOptional()
  totalQtyOrdered?: number;

  @ApiPropertyOptional()
  totalQtyRemaining?: number;

  @ApiPropertyOptional()
  consumptionPercent?: number;
}

export class BulkOrderLineItemDetailDto {
  @ApiProperty()
  lineItemId!: string;

  @ApiProperty()
  itemReference!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  qty!: number;

  @ApiProperty()
  unit!: string;

  @ApiProperty()
  ordered!: number;

  @ApiProperty()
  qtyRemaining!: number;

  @ApiProperty()
  deliveriesPercent!: number;

  @ApiProperty()
  pricePerUnit!: number;

  @ApiProperty()
  totalLineInc!: number;

  @ApiPropertyOptional()
  consumptionPercent?: number;
}

export class BulkOrderDetailDto {
  @ApiProperty({ description: 'Primary key — use this for routing to the detail/sub-resources' })
  id!: string;

  @ApiProperty({ description: 'Human-readable bulk order number, e.g. BULK-0001' })
  bulkId!: string;

  @ApiPropertyOptional()
  rfqReference!: string | null;

  @ApiProperty()
  contractorName!: string;

  @ApiProperty()
  vendorName!: string;

  @ApiProperty()
  projectName!: string;

  @ApiProperty()
  createdDate!: string;

  @ApiPropertyOptional()
  endDate!: string | null;

  @ApiProperty()
  createdBy!: string;

  @ApiPropertyOptional()
  status?: string;

  @ApiPropertyOptional()
  overallConsumptionPercent?: number;

  @ApiProperty({ type: [BulkOrderLineItemDetailDto] })
  lineItems!: BulkOrderLineItemDetailDto[];
}

export class PaginatedBulkOrdersResponseDto {
  @ApiProperty({ type: [BulkOrderListItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkOrderListItemDto)
  items!: BulkOrderListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  @ValidateNested()
  @Type(() => PaginationMetaDto)
  meta!: PaginationMetaDto;
}

// ── Create / Update DTOs ─────────────────────────────────────────────────────

export class CreateBulkOrderLineItemDto {
  @ApiProperty()
  @IsString()
  itemReference!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  qty!: number;

  @ApiProperty()
  @IsString()
  unit!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  pricePerUnit!: number;
}

export class CreateBulkOrderDto {
  @ApiProperty()
  @IsUUID()
  projectId!: string;

  @ApiProperty()
  @IsUUID()
  vendorId!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  rfqId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  brands?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ type: [CreateBulkOrderLineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBulkOrderLineItemDto)
  lineItems!: CreateBulkOrderLineItemDto[];
}

export class UpdateBulkOrderDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  brands?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'EXPIRED', 'COMPLETED', 'CANCELLED'] })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Reassign bulk order to a different project (internal, no vendor notification)',
  })
  @IsUUID()
  @IsOptional()
  projectId?: string;
}

export class UpdateBulkOrderLineItemDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  itemReference?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @IsOptional()
  qty?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  pricePerUnit?: number;
}

export class CreateDrawdownDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: 'Line item ID to draw down from' })
  @IsUUID()
  lineItemId!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  purchaseOrderId?: string;
}
