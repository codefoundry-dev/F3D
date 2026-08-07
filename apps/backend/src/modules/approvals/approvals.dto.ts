import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/**
 * Nominate Approver Pool members on a document already awaiting approval
 * (FOR-308).
 *
 * Routing only: the ids decide who is *notified*, never who may approve. Ids
 * outside the document's current Approver Pool are rejected server-side — the
 * UI's picker is a convenience, not the control.
 */
export class NominateApproversDto {
  @ApiProperty({
    type: [String],
    description:
      'Approver Pool member ids to notify. Must all be in the pool. ' +
      'Re-nominating an existing nominee is a no-op, not a second email.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  userIds!: string[];
}
