import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditAction, PoStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  expectedDeliveryBefore,
  expectedDeliveryDateOf,
  startOfToday,
} from '../deliveries/expected-delivery.util';

import { canTransition } from './po-state-machine';

/**
 * Where a vendor's acceptance lands (FOR-396): a PO that already has a delivery
 * date is scheduled for delivery straight away; one without stays ACCEPTED
 * until a date is set (the daily sweep picks it up then).
 */
export function acceptedStatusFor(po: Parameters<typeof expectedDeliveryDateOf>[0]): PoStatus {
  return expectedDeliveryDateOf(po) ? PoStatus.SCHEDULED_FOR_DELIVERY : PoStatus.ACCEPTED;
}

/** A PO has some delivery date at any level of the expected-date coalesce. */
const HAS_DELIVERY_DATE: Prisma.PurchaseOrderWhereInput = {
  OR: [
    { plannedDeliveryDate: { not: null } },
    { deadlineEnd: { not: null } },
    { deliveries: { some: { deliveryDate: { not: null } } } },
    { lineItems: { some: { expectedDeliveryDate: { not: null } } } },
  ],
};

/** Nothing has been received against the PO yet. */
const NOTHING_RECEIVED: Prisma.PurchaseOrderWhereInput = {
  lineItems: { none: { quantityDelivered: { gt: 0 } } },
};

type Move = { from: PoStatus; to: PoStatus; action: AuditAction };

/**
 * Daily sweep that keeps accepted POs' delivery status current (FOR-396). The
 * vendor never sets SCHEDULED_FOR_DELIVERY or LATE_FOR_DELIVERY by hand, so this
 * job does, using the same expected date as the Expected Deliveries list:
 *
 * - ACCEPTED with a delivery date → SCHEDULED_FOR_DELIVERY
 * - SCHEDULED_FOR_DELIVERY past its date → LATE_FOR_DELIVERY
 * - LATE_FOR_DELIVERY whose date was pushed out (approved change), with nothing
 *   received yet → back to SCHEDULED_FOR_DELIVERY
 *
 * Each move is claimed with a status-conditional update, so a re-run or a
 * second container cannot apply (or audit) it twice. Runs before the 07:00
 * reminder sweeps so they see today's statuses.
 */
@Injectable()
export class PoDeliveryScheduleService {
  private readonly logger = new Logger(PoDeliveryScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM, { name: 'po-delivery-schedule' })
  async runDailySweep(): Promise<void> {
    try {
      const counts = await this.sweep();
      if (counts.scheduled + counts.late + counts.rescheduled > 0) {
        this.logger.log(
          `PO delivery schedule: ${counts.scheduled} scheduled, ${counts.late} late, ${counts.rescheduled} back on schedule`,
        );
      }
    } catch (error) {
      this.logger.error(`PO delivery schedule sweep failed: ${String(error)}`);
    }
  }

  async sweep(today: Date = startOfToday()) {
    // Order matters: an accepted PO whose date has already passed is scheduled
    // and then flagged late in the same run.
    const scheduled = await this.apply(
      { status: PoStatus.ACCEPTED, ...HAS_DELIVERY_DATE },
      {
        from: PoStatus.ACCEPTED,
        to: PoStatus.SCHEDULED_FOR_DELIVERY,
        action: AuditAction.PO_SCHEDULED,
      },
    );
    const late = await this.apply(
      { status: PoStatus.SCHEDULED_FOR_DELIVERY, AND: [expectedDeliveryBefore(today)] },
      {
        from: PoStatus.SCHEDULED_FOR_DELIVERY,
        to: PoStatus.LATE_FOR_DELIVERY,
        action: AuditAction.PO_MARKED_LATE,
      },
    );
    const rescheduled = await this.apply(
      {
        status: PoStatus.LATE_FOR_DELIVERY,
        AND: [HAS_DELIVERY_DATE, NOTHING_RECEIVED, { NOT: expectedDeliveryBefore(today) }],
      },
      {
        from: PoStatus.LATE_FOR_DELIVERY,
        to: PoStatus.SCHEDULED_FOR_DELIVERY,
        action: AuditAction.PO_SCHEDULED,
      },
    );
    return { scheduled, late, rescheduled };
  }

  private async apply(where: Prisma.PurchaseOrderWhereInput, move: Move): Promise<number> {
    if (!canTransition(move.from, move.to)) return 0;
    const candidates = await this.prisma.purchaseOrder.findMany({ where, select: { id: true } });

    let moved = 0;
    for (const { id } of candidates) {
      const claimed = await this.prisma.purchaseOrder.updateMany({
        where: { id, status: move.from },
        data: { status: move.to },
      });
      if (claimed.count === 0) continue;
      moved += 1;
      try {
        await this.auditService.log({
          action: move.action,
          performedById: null,
          targetType: 'PurchaseOrder',
          targetId: id,
          metadata: { from: move.from, to: move.to, source: 'DELIVERY_SCHEDULE_JOB' },
        });
      } catch (err) {
        this.logger.debug(`Failed to audit PO ${id} ${move.from}→${move.to}: ${String(err)}`);
      }
    }
    return moved;
  }
}
