import type { INestApplication } from '@nestjs/common';
import { PoStatus, RfqStatus } from '@prisma/client';
import request from 'supertest';

import type { PrismaService } from '../../src/prisma/prisma.service';

import {
  AuthTokens,
  authRequest,
  bootstrapTestApp,
  getHttpServer,
  loginUser,
  SEED_USERS,
  teardownTestApp,
} from './test-helpers';

/**
 * FOR-213 — Email log per RFQ and PO via Resend webhooks.
 *
 * Acceptance criteria under test:
 *   • "Resend webhook receiver captures send / delivered / opened / bounced events"
 *   • "E2E test: simulate a bounce event → log reflects it"
 *
 * The send path itself is replaced by MockEmailService in e2e, so we seed an
 * outbound EmailMessage directly (as the real notification layer would), then
 * drive delivery events through the public POST /v1/webhooks/resend receiver and
 * assert they surface on the per-RFQ / per-PO email log endpoints.
 */
describe('Email log webhook → RFQ/PO log (FOR-213, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let procurement: AuthTokens;
  let contractorId: string;
  let procurementUserId: string;

  let rfqId: string;
  let poId: string;
  const stamp = Date.now();
  const rfqMessageId = `resend-rfq-${stamp}`;
  const poMessageId = `resend-po-${stamp}`;

  const post = (body: unknown) => request(getHttpServer()).post('/v1/webhooks/resend').send(body);

  beforeAll(async () => {
    const ctx = await bootstrapTestApp();
    app = ctx.app;
    prisma = ctx.prisma;

    procurement = await loginUser(
      SEED_USERS.procurementOfficer.email,
      SEED_USERS.procurementOfficer.password,
    );

    const user = await prisma.user.findUnique({
      where: { email: SEED_USERS.procurementOfficer.email },
      select: { id: true, companyId: true },
    });
    if (!user?.companyId) {
      throw new Error('Test seed missing — procurement officer must belong to a company.');
    }
    procurementUserId = user.id;
    contractorId = user.companyId;

    const project = await prisma.project.findFirst({
      where: { companyId: contractorId },
      select: { id: true },
    });
    if (!project) {
      throw new Error('Test seed missing — expected a project in the contractor company.');
    }

    const rfq = await prisma.rfq.create({
      data: {
        rfqNumber: `RFQ-FOR213-${stamp}`,
        companyId: contractorId,
        projectId: project.id,
        createdByUserId: procurementUserId,
        status: RfqStatus.OPEN,
      },
      select: { id: true },
    });
    rfqId = rfq.id;

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-FOR213-${stamp}`,
        companyId: contractorId,
        projectId: project.id,
        createdByUserId: procurementUserId,
        status: PoStatus.SENT,
      },
      select: { id: true },
    });
    poId = po.id;

    // Two outbound emails already on file — one per entity — awaiting events.
    await prisma.emailMessage.create({
      data: {
        companyId: contractorId,
        rfqId,
        template: 'rfq-received',
        toEmail: 'vendor@for213.local',
        subject: `RFQ-FOR213-${stamp}`,
        provider: 'RESEND',
        providerMessageId: rfqMessageId,
        status: 'SENT',
        sentAt: new Date(),
      },
    });
    await prisma.emailMessage.create({
      data: {
        companyId: contractorId,
        purchaseOrderId: poId,
        template: 'po-issued',
        toEmail: 'vendor@for213.local',
        subject: `PO-FOR213-${stamp}`,
        provider: 'RESEND',
        providerMessageId: poMessageId,
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    // Deleting the parents cascades to their email_messages + email_events.
    if (rfqId) await prisma.rfq.delete({ where: { id: rfqId } }).catch(() => undefined);
    if (poId) await prisma.purchaseOrder.delete({ where: { id: poId } }).catch(() => undefined);
    await teardownTestApp();
  });

  it('reflects a bounce event on the RFQ email log', async () => {
    const bounce = {
      type: 'email.bounced',
      created_at: '2026-06-04T10:00:00.000Z',
      data: {
        email_id: rfqMessageId,
        created_at: '2026-06-04T10:00:00.000Z',
        bounce: { type: 'Permanent', message: 'Mailbox does not exist' },
      },
    };

    const hook = await post(bounce);
    expect(hook.status).toBe(200);
    expect(hook.body.data.received).toBe(true);

    const res = await authRequest('get', `/v1/rfqs/${rfqId}/emails`, procurement.accessToken).expect(
      200,
    );
    const entries = res.body.data as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      toEmail: 'vendor@for213.local',
      status: 'BOUNCED',
      bounceReason: 'Mailbox does not exist',
    });
    expect(entries[0].bouncedAt).toBe('2026-06-04T10:00:00.000Z');

    const events = entries[0].events as Array<Record<string, unknown>>;
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('BOUNCED');
  });

  it('is idempotent — re-delivering the same bounce does not duplicate the event', async () => {
    const bounce = {
      type: 'email.bounced',
      created_at: '2026-06-04T10:00:00.000Z',
      data: {
        email_id: rfqMessageId,
        created_at: '2026-06-04T10:00:00.000Z',
        bounce: { type: 'Permanent', message: 'Mailbox does not exist' },
      },
    };

    await post(bounce).expect(200);

    const res = await authRequest('get', `/v1/rfqs/${rfqId}/emails`, procurement.accessToken).expect(
      200,
    );
    const entries = res.body.data as Array<Record<string, unknown>>;
    const events = entries[0].events as unknown[];
    expect(events).toHaveLength(1);
  });

  it('acknowledges (200) a webhook for an unknown message without erroring', async () => {
    const res = await post({
      type: 'email.delivered',
      data: { email_id: `unknown-${stamp}`, created_at: '2026-06-04T10:00:00.000Z' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.received).toBe(true);
  });

  it('captures delivered → opened on the PO email log and counts opens', async () => {
    await post({
      type: 'email.delivered',
      data: { email_id: poMessageId, created_at: '2026-06-04T10:00:00.000Z' },
    }).expect(200);

    await post({
      type: 'email.opened',
      data: { email_id: poMessageId, created_at: '2026-06-04T10:05:00.000Z' },
    }).expect(200);

    const res = await authRequest(
      'get',
      `/v1/purchase-orders/${poId}/emails`,
      procurement.accessToken,
    ).expect(200);
    const entries = res.body.data as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ status: 'OPENED', openCount: 1 });
    expect(entries[0].deliveredAt).toBe('2026-06-04T10:00:00.000Z');
    expect(entries[0].openedAt).toBe('2026-06-04T10:05:00.000Z');

    const events = entries[0].events as unknown[];
    expect(events).toHaveLength(2);
  });

  it('does not leak the email log to another company (404)', async () => {
    const northside = await loginUser(
      SEED_USERS.northsideAdmin.email,
      SEED_USERS.northsideAdmin.password,
    );

    await authRequest('get', `/v1/rfqs/${rfqId}/emails`, northside.accessToken).expect(404);
  });
});
