import type {
  CreateDeliveryReportInput,
  CreateDeliveryReportLineInput,
  PortalIdentifyInput,
  PortalSubmitInput,
  PortalVerifyInput,
  RejectDeliveryReportInput,
} from '@forethread/shared-types';
import {
  DamageDisposition,
  DamageType,
  DeliveryOutcome,
  DeliveryReportSource,
  DeliveryReportStatus,
} from '@forethread/shared-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
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
 * One line of a Delivery Report at create/submit time. Implements
 * CreateDeliveryReportLineInput from the shared contract: a line references a PO
 * line (`poLineItemId`), the received quantity (may exceed ordered), and an
 * outcome. Damage fields are required by the service when outcome === DAMAGED.
 */
export class CreateDeliveryReportLineDto implements CreateDeliveryReportLineInput {
  @ApiProperty({ description: 'The PO line item this delivery line reports against' })
  @IsUUID()
  poLineItemId!: string;

  @ApiProperty({ description: 'Quantity received this delivery (may exceed the ordered quantity)' })
  @IsInt()
  @Min(0)
  quantityReceived!: number;

  @ApiProperty({ enum: DeliveryOutcome, description: 'Per-line delivery outcome' })
  @IsEnum(DeliveryOutcome)
  outcome!: DeliveryOutcome;

  @ApiPropertyOptional({ description: 'Free-text notes for this line' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Damaged quantity (required when outcome is DAMAGED)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  damagedQuantity?: number;

  @ApiPropertyOptional({ enum: DamageType, description: 'Category of damage (when DAMAGED)' })
  @IsOptional()
  @IsEnum(DamageType)
  damageType?: DamageType;

  @ApiPropertyOptional({
    enum: DamageDisposition,
    description: 'Whether damaged goods were RETURNED or ACCEPTED (when DAMAGED)',
  })
  @IsOptional()
  @IsEnum(DamageDisposition)
  damageDisposition?: DamageDisposition;
}

/**
 * Create an INTERNAL Delivery Report (web app). Implements
 * CreateDeliveryReportInput. The report is created as SUBMITTED; the buyer later
 * approves (flows quantities to PO + inventory) or rejects it.
 */
export class CreateDeliveryReportDto implements CreateDeliveryReportInput {
  @ApiProperty({ description: 'Purchase order this delivery is recorded against' })
  @IsUUID()
  purchaseOrderId!: string;

  @ApiPropertyOptional({ description: 'Delivery date (ISO 8601)' })
  @IsOptional()
  @IsString()
  deliveryDate?: string;

  @ApiPropertyOptional({ description: 'Delivery location (a ProjectLocation id)' })
  @IsOptional()
  @IsUUID()
  deliveryLocationId?: string;

  @ApiPropertyOptional({ description: 'Project the delivery belongs to' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Vendor that fulfilled the delivery (a Company id)' })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiPropertyOptional({ description: 'On-site contact person' })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({ description: 'On-site contact phone' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Overall delivery notes' })
  @IsOptional()
  @IsString()
  overallNotes?: string;

  @ApiProperty({ type: [CreateDeliveryReportLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateDeliveryReportLineDto)
  lines!: CreateDeliveryReportLineDto[];
}

/** Reject a submitted Delivery Report (PATCH …/reject). Reason required. */
export class RejectDeliveryReportDto implements RejectDeliveryReportInput {
  @ApiProperty({ description: 'Reason the delivery report is being rejected' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

/**
 * List / query filters for delivery reports (internal list). Mirrors the
 * material-request list query: filters narrow directly and compose; page/limit
 * paginate.
 */
export class ListDeliveryReportQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search over report/PO number and submitter' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by vendor (a Company id)' })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiPropertyOptional({ enum: DeliveryReportStatus })
  @IsOptional()
  @IsEnum(DeliveryReportStatus)
  status?: DeliveryReportStatus;

  @ApiPropertyOptional({ enum: DeliveryReportSource })
  @IsOptional()
  @IsEnum(DeliveryReportSource)
  source?: DeliveryReportSource;

  @ApiPropertyOptional({ description: 'Filter by project' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Filter by delivery location (a ProjectLocation id)' })
  @IsOptional()
  @IsUUID()
  deliveryLocationId?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Page size', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

// ── Public QR portal DTOs ─────────────────────────────────────────────────────

/** Public portal step 1: the delivery person identifies themselves. */
export class PortalIdentifyDto implements PortalIdentifyInput {
  @ApiProperty({ description: 'Full name of the delivery person' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Email the access code is sent to' })
  @IsEmail()
  email!: string;
}

/** Public portal step 2: verify the emailed 6-digit access code. */
export class PortalVerifyDto implements PortalVerifyInput {
  @ApiProperty({ description: 'Email the code was sent to' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: '6-digit access code from the email' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}

/**
 * Public portal step 3: submit the delivery report. Submitter identity comes
 * from the session token, NOT the body. Implements PortalSubmitInput.
 */
export class PortalSubmitDto implements PortalSubmitInput {
  @ApiPropertyOptional({ description: 'Delivery date (ISO 8601)' })
  @IsOptional()
  @IsString()
  deliveryDate?: string;

  @ApiPropertyOptional({ description: 'On-site contact person' })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({ description: 'On-site contact phone' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Overall delivery notes' })
  @IsOptional()
  @IsString()
  overallNotes?: string;

  @ApiProperty({ type: [CreateDeliveryReportLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateDeliveryReportLineDto)
  lines!: CreateDeliveryReportLineDto[];
}
