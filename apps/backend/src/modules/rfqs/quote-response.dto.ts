import { DiscountType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
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
}

export class UpdateQuoteDto extends SubmitQuoteDto {}
