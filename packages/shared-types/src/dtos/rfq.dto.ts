import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

import { RfqStatus, VendorRfqStatus, QuickFilter } from '../enums';

import { BasePaginationQueryDto, PaginationMetaDto } from './pagination.dto';

// ── Create / Update DTOs ────────────────────────────────────────────────────

export class CreateRfqLineItemDto {
  @IsUUID()
  materialId!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsString()
  uom!: string;

  @IsString()
  @IsOptional()
  costCode?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  pickUp?: boolean;
}

export class CreateRfqDto {
  @IsUUID()
  projectId!: string;

  @IsDateString()
  deadlineEnd!: string;

  @IsUUID()
  deliveryLocationId!: string;

  @IsDateString()
  @IsOptional()
  needByDate?: string;

  @IsBoolean()
  @IsOptional()
  holdForRelease?: boolean;

  @IsDateString()
  @IsOptional()
  earliestDeliveryDate?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateRfqLineItemDto)
  lineItems!: CreateRfqLineItemDto[];

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  vendorIds!: string[];

  @IsString()
  @IsOptional()
  message?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentIds?: string[];
}

export class UpdateRfqDto {
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @IsDateString()
  @IsOptional()
  deadlineEnd?: string;

  @IsUUID()
  @IsOptional()
  deliveryLocationId?: string;

  @IsDateString()
  @IsOptional()
  needByDate?: string;

  @IsBoolean()
  @IsOptional()
  holdForRelease?: boolean;

  @IsDateString()
  @IsOptional()
  earliestDeliveryDate?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRfqLineItemDto)
  @IsOptional()
  lineItems?: CreateRfqLineItemDto[];

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  vendorIds?: string[];

  @IsString()
  @IsOptional()
  message?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentIds?: string[];
}

export class ValidateRfqBulkDto {}

// ── List / Query DTOs ───────────────────────────────────────────────────────

export class RfqListQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: [...Object.values(RfqStatus), ...Object.values(VendorRfqStatus)] })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ enum: QuickFilter })
  @IsEnum(QuickFilter)
  @IsOptional()
  quickFilter?: QuickFilter;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({
    enum: [
      'id',
      'projectName',
      'projectId',
      'status',
      'createdDate',
      'totalRequestedQty',
      'deadlineStart',
      'deadlineRange',
      'deliveryLocation',
      'pickUpLocation',
      'pickUp',
      'createdBy',
      'approvalStatus',
      'approvedBy',
      'lineItems',
      'reqQuantities',
      'recVendors',
      'recQuotes',
      'lastModifiedBy',
      'updatedAt',
    ],
  })
  @IsString()
  @IsOptional()
  sortBy?: string = 'createdDate';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  groupBy?: string;

  @ApiPropertyOptional({ description: 'Filter by delivery location (case-insensitive contains)' })
  @IsString()
  @IsOptional()
  deliveryLocation?: string;

  @ApiPropertyOptional({ description: 'Filter by the user who created the RFQ' })
  @IsUUID()
  @IsOptional()
  createdByUserId?: string;

  @ApiPropertyOptional({ description: 'Filter RFQs created on or after this date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  createdDateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter RFQs created on or before this date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  createdDateTo?: string;

  @ApiPropertyOptional({ description: 'Filter RFQs with deadlineStart on or after this date' })
  @IsDateString()
  @IsOptional()
  deadlineFrom?: string;

  @ApiPropertyOptional({ description: 'Filter RFQs with deadlineEnd on or before this date' })
  @IsDateString()
  @IsOptional()
  deadlineTo?: string;

  @ApiPropertyOptional({ description: 'Minimum number of approved quotes' })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minApprovedQuotes?: number;

  @ApiPropertyOptional({ description: 'Minimum number of distinct vendors with approved quotes' })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minApprovedVendors?: number;

  @ApiPropertyOptional({ description: 'Comma-separated column keys to export' })
  @IsString()
  @IsOptional()
  columns?: string;
}

// ── Response DTOs ────────────────────────────────────────────────────────────

export class RfqListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  projectName!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty({ description: 'RfqStatus for admins, VendorRfqStatus for vendors' })
  status!: string;

  @ApiProperty()
  reqQuantities!: number;

  @ApiProperty()
  pickUp!: boolean;

  @ApiPropertyOptional()
  deliveryLocation!: string | null;

  @ApiPropertyOptional()
  pickUpLocation!: string | null;

  @ApiProperty()
  recVendors!: number;

  @ApiProperty()
  recQuotes!: number;

  @ApiProperty()
  applVendors!: number;

  @ApiProperty()
  lineItems!: number;

  @ApiPropertyOptional()
  deadlineRange!: string | null;

  @ApiProperty()
  applIssues!: number;

  @ApiProperty()
  totalRequestedQty!: number;

  @ApiPropertyOptional()
  arcBlocksDist!: string | null;

  @ApiProperty()
  createdDate!: string;

  @ApiProperty()
  createdBy!: string;

  @ApiPropertyOptional()
  approvalStatus!: string | null;

  @ApiPropertyOptional()
  approvedBy!: string | null;

  @ApiPropertyOptional()
  lastModifiedBy!: string | null;
}

export class RfqResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  projectName!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty({ enum: RfqStatus })
  status!: RfqStatus;

  @ApiPropertyOptional()
  pickUpDate!: string | null;

  @ApiPropertyOptional()
  deliveryLocation!: string | null;

  @ApiPropertyOptional()
  pickUpLocation!: string | null;

  @ApiPropertyOptional()
  deadlineStart!: string | null;

  @ApiPropertyOptional()
  deadlineEnd!: string | null;

  @ApiProperty()
  totalRequestedQty!: number;

  @ApiPropertyOptional()
  approvalStatus!: string | null;

  @ApiPropertyOptional()
  approvedBy!: { id: string; name: string } | null;

  @ApiProperty()
  createdBy!: { id: string; name: string };

  @ApiProperty()
  lineItems!: Array<{
    id: string;
    materialName: string;
    quantity: number;
    unit: string;
    description: string | null;
  }>;

  @ApiProperty()
  quoteResponses!: Array<{
    id: string;
    vendorName: string;
    totalCost: number;
    status: string;
    submittedAt: string | null;
  }>;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class PaginatedRfqsResponseDto {
  @ApiProperty({ type: [RfqListItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RfqListItemDto)
  items!: RfqListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  @ValidateNested()
  @Type(() => PaginationMetaDto)
  meta!: PaginationMetaDto;
}
