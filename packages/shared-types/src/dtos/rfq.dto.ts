import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { RfqStatus, VendorRfqStatus, QuickFilter, RfqLineItemSource } from '../enums';

import { BasePaginationQueryDto, PaginationMetaDto } from './pagination.dto';

// ── Create / Update DTOs ────────────────────────────────────────────────────

export class CreateRfqLineItemDto {
  @ApiPropertyOptional({ enum: RfqLineItemSource, description: 'Origin of the line item (FOR-204)' })
  @IsEnum(RfqLineItemSource)
  @IsOptional()
  source?: RfqLineItemSource;

  @ApiPropertyOptional({ description: 'Catalog material id (catalog-sourced items)' })
  @IsUUID()
  @IsOptional()
  materialId?: string;

  @ApiPropertyOptional({ description: 'Free-text material name (BOM-sourced items without a catalog match)' })
  @IsString()
  @IsOptional()
  materialName?: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsString()
  uom!: string;

  @IsString()
  @IsOptional()
  costCode?: string;

  @ApiPropertyOptional({ description: 'Material description shown to vendors' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Per-line buyer notes (US 5.05)' })
  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  pickUp?: boolean;

  @ApiPropertyOptional({
    description: "Project this line is for — must be one of the RFQ's projects (US 5.05)",
  })
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Per-line delivery location (US 5.05)' })
  @IsUUID()
  @IsOptional()
  deliveryLocationId?: string;

  @ApiPropertyOptional({ description: 'Per-line expected delivery date (ISO 8601, US 5.05)' })
  @IsDateString()
  @IsOptional()
  expectedDeliveryDate?: string;
}

export class CreateRfqDto {
  @IsUUID()
  projectId!: string;

  @ApiPropertyOptional({ description: 'Buyer-facing document name (US 5.05 "Document name")' })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'All projects this RFQ spans (US 5.05). First entry is the primary project; when omitted, projectId is the only project.',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @IsOptional()
  projectIds?: string[];

  @ApiPropertyOptional({ description: 'Materials are picked up rather than delivered (US 5.05)' })
  @IsBoolean()
  @IsOptional()
  isPickUp?: boolean;

  @ApiPropertyOptional({ description: 'Pick-up location (free text)' })
  @IsString()
  @IsOptional()
  pickUpLocation?: string;

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

  @ApiPropertyOptional({ description: 'Buyer-facing document name (US 5.05 "Document name")' })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Replace the full project set (US 5.05). First entry becomes the primary project.',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @IsOptional()
  projectIds?: string[];

  @ApiPropertyOptional({ description: 'Materials are picked up rather than delivered (US 5.05)' })
  @IsBoolean()
  @IsOptional()
  isPickUp?: boolean;

  @ApiPropertyOptional({ description: 'Pick-up location (free text)' })
  @IsString()
  @IsOptional()
  pickUpLocation?: string;

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

/**
 * Draft save-as-you-go DTO (FOR-202).
 *
 * Unlike CreateRfqDto, every field except `projectId` is optional and there are
 * no `ArrayMinSize` constraints — this lets the multi-step form persist a DRAFT
 * after step 1 (project chosen) and keep PATCHing as later steps are completed.
 * `projectId` stays required because the Rfq.projectId column is non-nullable.
 */
export class SaveRfqDraftDto {
  @IsUUID()
  projectId!: string;

  @ApiPropertyOptional({ description: 'Buyer-facing document name (US 5.05 "Document name")' })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'All projects this RFQ spans (US 5.05). First entry is the primary project; when omitted, projectId is the only project.',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @IsOptional()
  projectIds?: string[];

  @ApiPropertyOptional({ description: 'Materials are picked up rather than delivered (US 5.05)' })
  @IsBoolean()
  @IsOptional()
  isPickUp?: boolean;

  @ApiPropertyOptional({ description: 'Pick-up location (free text)' })
  @IsString()
  @IsOptional()
  pickUpLocation?: string;

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

/**
 * Send-RFQ DTO (FOR-203).
 *
 * The body is optional on the `POST /rfqs/:id/send` action; when present it
 * carries the CC recipients that should be copied on the outbound vendor
 * emails. Attachments are not listed here — they travel from the RFQ's already
 * uploaded documents, so the send action attaches them automatically.
 */
export class SendRfqDto {
  @ApiPropertyOptional({ type: [String], description: 'CC email recipients for the vendor emails' })
  @Transform(({ value }: { value: unknown }): unknown => {
    if (!Array.isArray(value)) return value;
    return (value as unknown[])
      .map((v) => (typeof v === 'string' ? v.trim() : v))
      .filter((v) => v !== '');
  })
  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  cc?: string[];
}

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

// ── Availability check / bulk-order coverage (US 5.05) ──────────────────────

/** One prospective RFQ line to check against the company's active bulk orders. */
export class RfqAvailabilityLineItemDto {
  @ApiProperty({ description: "Caller-side index used to correlate the response's matches" })
  @IsInt()
  @Min(0)
  index!: number;

  @ApiPropertyOptional({ description: 'Catalog material id — resolved to the material name' })
  @IsUUID()
  @IsOptional()
  materialId?: string;

  @ApiPropertyOptional({ description: 'Free-text material name (used when no materialId)' })
  @IsString()
  @IsOptional()
  materialName?: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsString()
  uom!: string;
}

export class CheckRfqAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => RfqAvailabilityLineItemDto)
  lineItems!: RfqAvailabilityLineItemDto[];
}

/** One drawdown allocation covering (part of) a draft RFQ line item from a bulk-order line. */
export class RfqCoverageAllocationDto {
  @IsUUID()
  rfqLineItemId!: string;

  @IsUUID()
  bulkOrderLineItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ConfirmRfqCoverageDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => RfqCoverageAllocationDto)
  allocations!: RfqCoverageAllocationDto[];
}

// ── Availability check response shapes ───────────────────────────────────────

export interface RfqAvailabilityVendorDto {
  vendorId: string;
  vendorName: string;
}

export interface RfqAvailabilityMatchDto {
  bulkOrderId: string;
  bulkOrderNumber: string | null;
  bulkOrderLineItemId: string;
  vendorId: string;
  qtyRemaining: number;
  /** Bulk order endDate (ISO 8601) — null when open-ended. */
  expirationDate: string | null;
  pricePerUnit: number;
}

export interface RfqAvailabilityItemDto {
  index: number;
  matches: RfqAvailabilityMatchDto[];
}

export interface RfqAvailabilityResponseDto {
  vendors: RfqAvailabilityVendorDto[];
  items: RfqAvailabilityItemDto[];
}
