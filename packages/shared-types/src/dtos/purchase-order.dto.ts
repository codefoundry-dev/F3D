import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  ApprovalStatus,
  PickUpTimeExpectation,
  PoQuickFilter,
  PoPriority,
  PoSourceOfCreation,
  PoStatus,
  PoType,
} from '../enums';

import { BasePaginationQueryDto, PaginationMetaDto } from './pagination.dto';

// ── Request DTOs ─────────────────────────────────────────────────────────────

export class PoListQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: PoStatus })
  @IsEnum(PoStatus)
  @IsOptional()
  status?: PoStatus;

  @ApiPropertyOptional({ enum: PoQuickFilter })
  @IsEnum(PoQuickFilter)
  @IsOptional()
  quickFilter?: PoQuickFilter;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({
    enum: ['id', 'projectName', 'status', 'createdDate', 'totalAmount'],
  })
  @IsString()
  @IsOptional()
  sortBy?: string = 'createdDate';

  @ApiPropertyOptional({ description: 'Comma-separated column keys to export' })
  @IsString()
  @IsOptional()
  columns?: string;
}

export class CreatePoLineItemDto {
  @IsUUID()
  @IsOptional()
  materialId?: string;

  /**
   * The bulk-order line this PO line draws from (US 5.09 drawdown-from-PO). Set
   * only when the parent PO is sourced from a bulk order; the create endpoint
   * uses it to validate against `qtyRemaining` and write the Drawdown row.
   */
  @IsUUID()
  @IsOptional()
  bulkOrderLineItemId?: string;

  @IsOptional()
  @IsString()
  materialCode?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  quantityOrdered!: number;

  @IsString()
  unitOfMeasure!: string;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsString()
  costCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsDateString()
  @IsOptional()
  expectedDeliveryDate?: string;

  @IsUUID()
  @IsOptional()
  deliveryLocationId?: string;

  @IsBoolean()
  @IsOptional()
  pickUp?: boolean;
}

export class CreatePoDeliveryDto {
  @IsUUID()
  @IsOptional()
  deliveryLocationId?: string;

  @IsDateString()
  @IsOptional()
  deliveryDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreatePurchaseOrderDto {
  @IsOptional()
  @IsString()
  documentName?: string;

  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsUUID()
  vendorId?: string;

  /**
   * The source bulk order for a drawdown PO (US 5.09). When present together
   * with `sourceOfCreation === BULK_DRAWDOWN`, the create endpoint draws each
   * line item with a `bulkOrderLineItemId` down against the bulk order and
   * forces `poType = DRAWDOWN`.
   */
  @IsOptional()
  @IsUUID()
  bulkOrderId?: string;

  // Optional at create: a draft PO (e.g. created from an approved RFQ quote) is
  // intentionally incomplete. The buyer sets the delivery location + planned
  // date in the PO wizard before the PO is issued. Both columns are nullable.
  @IsUUID()
  @IsOptional()
  deliveryLocationId?: string;

  @IsDateString()
  @IsOptional()
  plannedDeliveryDate?: string;

  @IsEnum(PoType)
  @IsOptional()
  poType?: PoType;

  @IsEnum(PoSourceOfCreation)
  @IsOptional()
  sourceOfCreation?: PoSourceOfCreation;

  @IsEnum(PoPriority)
  @IsOptional()
  priority?: PoPriority;

  @IsBoolean()
  @IsOptional()
  holdForRelease?: boolean;

  @IsDateString()
  @IsOptional()
  deadlineStart?: string;

  @IsDateString()
  @IsOptional()
  deadlineEnd?: string;

  @IsBoolean()
  @IsOptional()
  pickUp?: boolean;

  @IsString()
  @IsOptional()
  pickUpLocation?: string;

  @IsEnum(PickUpTimeExpectation)
  @IsOptional()
  pickUpTimeExpectation?: PickUpTimeExpectation;

  @IsString()
  @IsOptional()
  pickUpPersonName?: string;

  @IsString()
  @IsOptional()
  pickUpPersonPhone?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsInt()
  @Min(0)
  @Max(365)
  @IsOptional()
  paymentTermsDays?: number;

  @IsString()
  @IsOptional()
  costCode?: string;

  @IsUUID()
  @IsOptional()
  rfqId?: string;

  @IsString()
  @IsOptional()
  deliveryNotes?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  deliveryResponsibleName?: string;

  @IsString()
  @IsOptional()
  deliveryResponsibleEmail?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePoLineItemDto)
  lineItems!: CreatePoLineItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePoDeliveryDto)
  @IsOptional()
  deliveries?: CreatePoDeliveryDto[];
}

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsString()
  documentName?: string;

  @IsUUID()
  @IsOptional()
  vendorId?: string;

  @IsUUID()
  @IsOptional()
  deliveryLocationId?: string;

  @IsDateString()
  @IsOptional()
  plannedDeliveryDate?: string;

  @IsEnum(PoType)
  @IsOptional()
  poType?: PoType;

  @IsEnum(PoSourceOfCreation)
  @IsOptional()
  sourceOfCreation?: PoSourceOfCreation;

  @IsEnum(PoPriority)
  @IsOptional()
  priority?: PoPriority;

  @IsBoolean()
  @IsOptional()
  holdForRelease?: boolean;

  @IsDateString()
  @IsOptional()
  deadlineStart?: string;

  @IsDateString()
  @IsOptional()
  deadlineEnd?: string;

  @IsBoolean()
  @IsOptional()
  pickUp?: boolean;

  @IsString()
  @IsOptional()
  pickUpLocation?: string;

  @IsEnum(PickUpTimeExpectation)
  @IsOptional()
  pickUpTimeExpectation?: PickUpTimeExpectation;

  @IsString()
  @IsOptional()
  pickUpPersonName?: string;

  @IsString()
  @IsOptional()
  pickUpPersonPhone?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsInt()
  @Min(0)
  @Max(365)
  @IsOptional()
  paymentTermsDays?: number;

  @IsString()
  @IsOptional()
  costCode?: string;

  @IsUUID()
  @IsOptional()
  rfqId?: string;

  @IsString()
  @IsOptional()
  deliveryNotes?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  deliveryResponsibleName?: string;

  @IsString()
  @IsOptional()
  deliveryResponsibleEmail?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePoLineItemDto)
  @IsOptional()
  lineItems?: CreatePoLineItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePoDeliveryDto)
  @IsOptional()
  deliveries?: CreatePoDeliveryDto[];
}

// ── Response DTOs ────────────────────────────────────────────────────────────

export class PoListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  poNumber!: string;

  @ApiProperty()
  projectName!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty({ description: 'Human-readable project code (PRJ-YYYY-NNN)' })
  projectCode!: string;

  @ApiProperty({ enum: PoStatus })
  status!: PoStatus;

  @ApiProperty({ enum: PoType })
  poType!: PoType;

  @ApiPropertyOptional()
  revision!: number | null;

  @ApiProperty()
  holdForRelease!: boolean;

  @ApiProperty()
  reqQuantities!: number;

  @ApiProperty()
  pickUp!: boolean;

  @ApiPropertyOptional()
  deliveryLocationId!: string | null;

  @ApiPropertyOptional()
  pickUpLocation!: string | null;

  @ApiProperty()
  recVendors!: number;

  @ApiProperty()
  lineItems!: number;

  @ApiPropertyOptional()
  deadlineRange!: string | null;

  @ApiProperty()
  totalRequestedQty!: number;

  @ApiProperty()
  createdDate!: string;

  @ApiProperty()
  createdBy!: string;

  @ApiPropertyOptional({ enum: ApprovalStatus })
  approvalStatus!: ApprovalStatus | null;

  @ApiPropertyOptional()
  approvedBy!: string | null;

  @ApiPropertyOptional()
  lastModifiedBy!: string | null;

  @ApiPropertyOptional()
  contractorName!: string | null;

  @ApiPropertyOptional()
  vendorName!: string | null;

  @ApiPropertyOptional()
  totalAmount!: number | null;

  @ApiPropertyOptional({ enum: PoSourceOfCreation })
  sourceOfCreation!: PoSourceOfCreation | null;

  @ApiPropertyOptional({ enum: PoPriority })
  priority!: PoPriority | null;

  @ApiPropertyOptional()
  paymentTermsDays!: number | null;

  @ApiPropertyOptional()
  lineItemsDelivered!: number | null;

  @ApiPropertyOptional()
  quantityDelivered!: number | null;

  @ApiPropertyOptional()
  linkedRfqAvgPrice!: number | null;

  @ApiPropertyOptional()
  attachmentsCount!: number | null;

  @ApiPropertyOptional()
  hasMessages!: boolean | null;
}

export class ValidateItemLineDto {
  @IsString()
  @IsOptional()
  materialId?: string;

  @IsString()
  @IsOptional()
  materialName?: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ValidatePoItemsDto {
  @IsUUID()
  projectId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidateItemLineDto)
  lineItems!: ValidateItemLineDto[];
}

export class PoLineItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  lineNumber!: number;

  @ApiProperty()
  materialId!: string;

  @ApiPropertyOptional()
  materialName!: string | null;

  @ApiPropertyOptional()
  materialCode!: string | null;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty()
  quantityOrdered!: number;

  @ApiProperty()
  quantityDelivered!: number;

  @ApiProperty()
  unitOfMeasure!: string;

  @ApiProperty()
  unitPrice!: number;

  @ApiProperty()
  lineTotal!: number;

  @ApiPropertyOptional()
  costCode!: string | null;

  @ApiPropertyOptional()
  expectedDeliveryDate!: string | null;

  @ApiPropertyOptional()
  deliveryLocationId!: string | null;

  @ApiPropertyOptional()
  notes!: string | null;

  @ApiPropertyOptional()
  pickUp!: boolean;
}

export class PoDocumentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  fileId!: string;

  @ApiProperty()
  uploadedBy!: string;

  @ApiProperty()
  uploadedAt!: string;
}

export class PoResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  projectName!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty({ enum: PoStatus })
  status!: PoStatus;

  @ApiProperty({ enum: PoType })
  poType!: PoType;

  @ApiProperty()
  revision!: number;

  @ApiProperty()
  pickUp!: boolean;

  @ApiPropertyOptional()
  deliveryLocationId!: string | null;

  @ApiPropertyOptional()
  pickUpLocation!: string | null;

  @ApiPropertyOptional({ enum: PickUpTimeExpectation })
  pickUpTimeExpectation!: PickUpTimeExpectation | null;

  @ApiPropertyOptional()
  pickUpPersonName!: string | null;

  @ApiPropertyOptional()
  pickUpPersonPhone!: string | null;

  @ApiPropertyOptional()
  totalAmount!: number | null;

  @ApiProperty()
  lineItemCount!: number;

  @ApiPropertyOptional()
  deadlineStart!: string | null;

  @ApiPropertyOptional()
  deadlineEnd!: string | null;

  @ApiPropertyOptional()
  paymentTermsDays!: number | null;

  @ApiPropertyOptional()
  message!: string | null;

  @ApiPropertyOptional()
  deliveryResponsibleName!: string | null;

  @ApiPropertyOptional()
  deliveryResponsibleEmail!: string | null;

  @ApiPropertyOptional({ enum: ApprovalStatus })
  approvalStatus!: ApprovalStatus | null;

  @ApiPropertyOptional()
  approvedBy!: { id: string; name: string } | null;

  @ApiPropertyOptional({ enum: PoSourceOfCreation })
  sourceOfCreation!: PoSourceOfCreation | null;

  @ApiProperty()
  createdBy!: { id: string; name: string };

  @ApiProperty()
  vendor!: { id: string; name: string };

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class PaginatedPosResponseDto {
  @ApiProperty({ type: [PoListItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PoListItemDto)
  items!: PoListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  @ValidateNested()
  @Type(() => PaginationMetaDto)
  meta!: PaginationMetaDto;
}
