import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Contractor decline of a purchase order (PATCH …/decline). A reason is
 * REQUIRED so the cancellation is always explained — stored on
 * PurchaseOrder.cancellationReason and echoed into the audit metadata.
 */
export class DeclinePoDto {
  @ApiProperty({ description: 'Reason the purchase order is being declined' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

/** A single line's received quantity for a delivery/receipt update. */
export class ReceivePoLineDto {
  @ApiProperty({ description: 'PoLineItem id being received against' })
  @IsUUID()
  lineItemId!: string;

  @ApiProperty({ description: 'Cumulative delivered quantity for this line' })
  @IsInt()
  @Min(0)
  quantityDelivered!: number;
}

/**
 * Record a delivery/receipt against a purchase order (PATCH …/receive). Each
 * entry sets the cumulative delivered quantity for one line item; the PO status
 * moves to PARTIALLY_DELIVERED or DELIVERED (all lines fully delivered) via the
 * state machine. This is the hook inventory will reuse later.
 */
export class ReceivePoDto {
  @ApiProperty({ type: [ReceivePoLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceivePoLineDto)
  lines!: ReceivePoLineDto[];
}
