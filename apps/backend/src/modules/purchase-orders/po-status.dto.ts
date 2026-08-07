import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
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

/**
 * Submit a purchase order (POST …/issue).
 *
 * The body exists only to carry the optional approver nomination (FOR-306). A
 * PO within the issuer's approval limit goes straight to the vendor and ignores
 * it; one that is over the limit is routed to the Approver Pool, and these ids
 * narrow *who is notified* about it.
 *
 * Omitting the field — or sending an empty array — notifies the whole Pool,
 * which is the pre-nomination behaviour, so existing callers are unaffected.
 */
export class IssuePoDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      'Approver Pool members to notify. Routing only: every Pool member keeps ' +
      'full authority to approve, whether nominated or not. Ids outside the ' +
      'Pool are rejected — a nomination can narrow, never widen.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  nomineeIds?: string[];
}
