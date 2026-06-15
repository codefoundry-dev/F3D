import { MaterialRequestPriority, MaterialRequestStatus } from '@forethread/shared-types';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * A single material requested on an MR. Mirrors the RFQ line-item shape: a line
 * carries either a catalogue `materialId` or a free-text `materialName` (the
 * service rejects a line that has neither). `unit` is the unit of measure.
 */
export class CreateMrLineItemDto {
  @ApiPropertyOptional({ description: 'Catalogue material id (omit for a free-text line)' })
  @IsOptional()
  @IsUUID()
  materialId?: string;

  @ApiPropertyOptional({ description: 'Free-text material name (when no catalogue material)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  materialName?: string;

  @ApiPropertyOptional({ description: 'Free-text description of the material' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Quantity requested (whole units, >= 1)' })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: 'Unit of measure (e.g. pcs, m, kg)' })
  @IsString()
  @IsNotEmpty()
  unit!: string;

  @ApiPropertyOptional({ enum: MaterialRequestPriority, description: 'Optional per-line priority' })
  @IsOptional()
  @IsEnum(MaterialRequestPriority)
  priority?: MaterialRequestPriority;

  @ApiPropertyOptional({ description: 'Expected delivery date for this line (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @ApiPropertyOptional({ description: 'Per-line delivery location (a ProjectLocation id)' })
  @IsOptional()
  @IsUUID()
  deliveryLocationId?: string;

  @ApiPropertyOptional({ description: 'Per-line notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Create a Material Request. `projectId` and at least one line item are
 * required. When `submit` is true the MR is created straight in SUBMITTED
 * (audited CREATED then SUBMITTED); otherwise it starts as a DRAFT.
 */
export class CreateMaterialRequestDto {
  @ApiProperty({ description: 'Project the materials are requested for' })
  @IsUUID()
  projectId!: string;

  @ApiPropertyOptional({
    enum: MaterialRequestPriority,
    description: 'Header priority (default MEDIUM)',
  })
  @IsOptional()
  @IsEnum(MaterialRequestPriority)
  priority?: MaterialRequestPriority;

  @ApiPropertyOptional({ description: 'Date the materials are needed by (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  neededByDate?: string;

  @ApiPropertyOptional({ description: 'Header default delivery location (a ProjectLocation id)' })
  @IsOptional()
  @IsUUID()
  deliveryLocationId?: string;

  @ApiPropertyOptional({ description: 'Optional header instructions / notes' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Submit immediately (create directly in SUBMITTED)' })
  @IsOptional()
  @IsBoolean()
  submit?: boolean;

  @ApiProperty({ type: [CreateMrLineItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateMrLineItemDto)
  lineItems!: CreateMrLineItemDto[];
}

/**
 * Update a DRAFT Material Request. All fields optional; when `lineItems` is
 * provided it replaces the whole set.
 */
export class UpdateMaterialRequestDto extends PartialType(CreateMaterialRequestDto) {}

/**
 * Decline a submitted MR (POST …/decline). A reason is REQUIRED so the decline
 * is always explained — stored on MaterialRequest.declineReason and echoed into
 * the audit metadata. Mirrors DeclinePoDto.
 */
export class DeclineMaterialRequestDto {
  @ApiProperty({ description: 'Reason the material request is being declined' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

/** Convert an APPROVED MR into a draft RFQ (POST …/convert-to-rfq). */
export class ConvertToRfqDto {
  @ApiPropertyOptional({ description: 'Optional document name for the created RFQ' })
  @IsOptional()
  @IsString()
  name?: string;
}

/** Convert an APPROVED MR into a draft PO (POST …/convert-to-po). */
export class ConvertToPoDto {
  @ApiProperty({ description: 'Vendor the purchase order is addressed to' })
  @IsUUID()
  vendorId!: string;
}

/**
 * List/query filters for material requests. `status`/`projectId`/`priority`
 * narrow directly; `mine` scopes to the caller's own requests; the quick-filter
 * booleans are convenience shortcuts (awaiting approval / approved / urgent /
 * overdue).
 */
export class ListMaterialRequestQueryDto {
  @ApiPropertyOptional({ enum: MaterialRequestStatus })
  @IsOptional()
  @IsEnum(MaterialRequestStatus)
  status?: MaterialRequestStatus;

  @ApiPropertyOptional({ description: 'Filter by project' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ enum: MaterialRequestPriority })
  @IsOptional()
  @IsEnum(MaterialRequestPriority)
  priority?: MaterialRequestPriority;

  @ApiPropertyOptional({ description: 'Only the current user’s own requests' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  mine?: boolean;

  @ApiPropertyOptional({ description: 'Quick filter: requests awaiting approval (SUBMITTED)' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  awaitingApproval?: boolean;

  @ApiPropertyOptional({ description: 'Quick filter: approved requests' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  approved?: boolean;

  @ApiPropertyOptional({ description: 'Quick filter: high-urgency requests (HIGH or URGENT)' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  urgent?: boolean;

  @ApiPropertyOptional({ description: 'Quick filter: past their needed-by date and still open' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  overdue?: boolean;
}
