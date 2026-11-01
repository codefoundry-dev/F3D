import { PoStatus } from '@prisma/client';

import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import { PoDeliveryScheduleService, acceptedStatusFor } from '../po-delivery-schedule.service';

const noDates = { plannedDeliveryDate: null, deadlineEnd: null, deliveries: [], lineItems: [] };

function makeService() {
  const prisma = {
    purchaseOrder: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new PoDeliveryScheduleService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  return { service, prisma, audit };
}

describe('acceptedStatusFor (FOR-396)', () => {
  it('schedules a PO that has any delivery date', () => {
    expect(acceptedStatusFor({ ...noDates, deadlineEnd: new Date('2026-12-01') })).toBe(
      PoStatus.SCHEDULED_FOR_DELIVERY,
    );
  });

  it('leaves a dateless PO accepted', () => {
    expect(acceptedStatusFor(noDates)).toBe(PoStatus.ACCEPTED);
  });
});

describe('PoDeliveryScheduleService (FOR-396)', () => {
  const today = new Date('2026-10-29T00:00:00');

  it('runs accepted → scheduled, then scheduled → late, then late → scheduled', async () => {
    const { service, prisma } = makeService();
    prisma.purchaseOrder.findMany
      .mockResolvedValueOnce([{ id: 'po-accepted' }])
      .mockResolvedValueOnce([{ id: 'po-overdue' }])
      .mockResolvedValueOnce([{ id: 'po-pushed-out' }]);

    const counts = await service.sweep(today);

    expect(counts).toEqual({ scheduled: 1, late: 1, rescheduled: 1 });
    const [scheduledWhere, lateWhere, rescheduledWhere] =
      prisma.purchaseOrder.findMany.mock.calls.map((c) => c[0].where);
    expect(scheduledWhere.status).toBe(PoStatus.ACCEPTED);
    expect(lateWhere.status).toBe(PoStatus.SCHEDULED_FOR_DELIVERY);
    // Same overdue predicate as the Expected Deliveries list (planned date first).
    expect(lateWhere.AND[0].OR[0]).toEqual({ plannedDeliveryDate: { lt: today } });
    expect(rescheduledWhere.status).toBe(PoStatus.LATE_FOR_DELIVERY);

    expect(prisma.purchaseOrder.updateMany.mock.calls.map((c) => c[0])).toEqual([
      {
        where: { id: 'po-accepted', status: PoStatus.ACCEPTED },
        data: { status: PoStatus.SCHEDULED_FOR_DELIVERY },
      },
      {
        where: { id: 'po-overdue', status: PoStatus.SCHEDULED_FOR_DELIVERY },
        data: { status: PoStatus.LATE_FOR_DELIVERY },
      },
      {
        where: { id: 'po-pushed-out', status: PoStatus.LATE_FOR_DELIVERY },
        // Back on schedule clears the FOR-394 reminder ledger.
        data: { status: PoStatus.SCHEDULED_FOR_DELIVERY, overdueReminderSentAt: null },
      },
    ]);
  });

  it('audits each move as a system action', async () => {
    const { service, prisma, audit } = makeService();
    prisma.purchaseOrder.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'po-1' }])
      .mockResolvedValueOnce([]);

    await service.sweep(today);

    expect(audit.log).toHaveBeenCalledWith({
      action: 'PO_MARKED_LATE',
      performedById: null,
      targetType: 'PurchaseOrder',
      targetId: 'po-1',
      metadata: {
        from: PoStatus.SCHEDULED_FOR_DELIVERY,
        to: PoStatus.LATE_FOR_DELIVERY,
        source: 'DELIVERY_SCHEDULE_JOB',
      },
    });
  });

  it('skips a PO another run already moved (no double audit)', async () => {
    const { service, prisma, audit } = makeService();
    prisma.purchaseOrder.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'po-1' }])
      .mockResolvedValueOnce([]);
    prisma.purchaseOrder.updateMany.mockResolvedValue({ count: 0 });

    const counts = await service.sweep(today);

    expect(counts.late).toBe(0);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('logs a summary from the daily job and survives an audit failure', async () => {
    const { service, prisma, audit } = makeService();
    prisma.purchaseOrder.findMany
      .mockResolvedValueOnce([{ id: 'po-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    audit.log.mockRejectedValueOnce(new Error('audit down'));

    await expect(service.runDailySweep()).resolves.toBeUndefined();
    expect(prisma.purchaseOrder.updateMany).toHaveBeenCalledTimes(1);
  });

  it('logs instead of throwing when the sweep fails', async () => {
    const { service, prisma } = makeService();
    prisma.purchaseOrder.findMany.mockRejectedValue(new Error('db down'));
    await expect(service.runDailySweep()).resolves.toBeUndefined();
  });
});
