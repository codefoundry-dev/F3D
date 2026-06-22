import { DiscountType, QuoteLineItemStatus, QuoteSource } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class QuoteLineItemDto {
  @IsUUID()
  rfqLineItemId!: string;

  @IsNotEmpty()
  @IsNumber()
  unitPrice!: number; // stored as Decimal

  @IsInt()
  @Min(0)
  quotedQuantity!: number;

  @IsOptional()
  @IsString()
  availability?: string; // AVAILABLE | PARTIALLY_AVAILABLE | UNAVAILABLE

  @IsDateString()
  deliveryDate!: string;

  @IsOptional()
  @IsUUID()
  substituteItemId?: string;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @IsOptional()
  @IsNumber()
  tax?: number;

  @IsOptional()
  @IsBoolean()
  taxIncluded?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  backOrderQty?: number;

  @IsOptional()
  @IsDateString()
  backOrderDeliveryDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubmitQuoteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteLineItemDto)
  lineItems!: QuoteLineItemDto[];

  // Bulk-level fields
  @IsOptional()
  @IsDateString()
  bulkDeliveryTime?: string;

  @IsOptional()
  @IsNumber()
  bulkDiscount?: number;

  @IsOptional()
  @IsNumber()
  bulkTax?: number;

  @IsOptional()
  @IsNumber()
  bulkShipment?: number;

  @IsOptional()
  @IsUUID()
  warehouseLocationId?: string;

  @IsOptional()
  @IsDateString()
  validityPeriod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];

  /** How the quote was entered: by hand (FORM) or via PDF upload (PDF). FOR-207. */
  @IsOptional()
  @IsEnum(QuoteSource)
  source?: QuoteSource;
}

export class UpdateQuoteDto extends SubmitQuoteDto {}

/**
 * Buyer's per-line review of a received quote (US 5.19): approve, decline or
 * restore (back to PENDING) one or more quote lines in a single call.
 */
export class UpdateQuoteLineItemStatusDto {
  @IsArray()
  @IsUUID('4', { each: true })
  lineItemIds!: string[];

  @IsEnum(QuoteLineItemStatus)
  status!: QuoteLineItemStatus;
}

/**
 * One awarded vendor line in a split award (US 5.19): the quote line being
 * awarded and the quantity granted to that vendor for it.
 */
export class AwardSplitAllocationDto {
  @IsUUID('4')
  quoteResponseId!: string;

  @IsUUID('4')
  quoteLineItemId!: string;

  @IsInt()
  @Min(1)
  approvedQuantity!: number;
}

/**
 * Split award (US 5.19 / PRD §4.5.4): approve line items across one or more
 * vendor quotes and allocate per-vendor quantities. The service mints a SPLIT
 * parent PO that owns one child PO per (vendor, project).
 */
export class AwardSplitDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AwardSplitAllocationDto)
  allocations!: AwardSplitAllocationDto[];
}
