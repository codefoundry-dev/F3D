import type { INestApplication } from '@nestjs/common';
import { AccessTokenPurpose, AccessTokenSubject } from '@prisma/client';
import request from 'supertest';

import { AccessTokensService } from '../../src/modules/access-tokens/access-tokens.service';
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
 * FOR-205 — Tokenized vendor portal (form-entry quote submission).
 *
 * Drives the no-signup portal end-to-end through the Public HTTP layer using an
 * A15 access token:
 *   • GET landing resolves the RFQ scope (incl. downloadable attachment URLs).
 *   • POST submits a quote → it is persisted with payment terms.
 *   • Submitting BURNS the token: a second GET and a second POST are rejected.
 */
describe('RFQ vendor portal (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessTokens: AccessTokensService;

  let admin: AuthTokens;

  let vendorId: string;
  let rfqId: string;
  let rfqVendorId: string;
  let rfqLineItemId: string;
  let fileId: string;

  beforeAll(async () => {
    const ctx = await bootstrapTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    accessTokens = app.get(AccessTokensService);

    admin = await loginUser(SEED_USERS.companyAdmin.email, SEED_USERS.companyAdmin.password);
  });

  afterAll(async () => {
    if (rfqId) {
      await prisma.quoteResponse.deleteMany({ where: { rfqId } });
      await prisma.accessToken.deleteMany({ where: { subjectId: rfqId } });
      await prisma.rfqDocument.deleteMany({ where: { rfqId } });
      await prisma.rfqVendor.deleteMany({ where: { rfqId } });
      await prisma.rfqLineItem.deleteMany({ where: { rfqId } });
      await prisma.rfq.delete({ where: { id: rfqId } }).catch(() => undefined);
    }
    if (fileId) await prisma.file.delete({ where: { id: fileId } }).catch(() => undefined);
    if (vendorId) {
      await prisma.companyVendorAssignment.deleteMany({ where: { vendorId } });
      await prisma.company.delete({ where: { id: vendorId } }).catch(() => undefined);
    }
    await teardownTestApp();
  });

  /** Issue a fresh, valid QUOTE_SUBMIT token for the invited vendor. */
  async function issueToken(): Promise<string> {
    const { token } = await accessTokens.issueToken({
      subjectType: AccessTokenSubject.RFQ,
      subjectId: rfqId,
      purpose: AccessTokenPurpose.QUOTE_SUBMIT,
      ttlMs: 60 * 60 * 1000,
      maxAttempts: 50,
      metadata: { rfqVendorId, vendorId },
    });
    return token;
  }

  it('sets up an OPEN RFQ with an invited vendor and an attachment', async () => {
    const contractor = await prisma.company.findFirst({
      where: { abn: 'TEST-CONTRACTOR-001' },
      select: { id: true },
    });
    expect(contractor).not.toBeNull();

    const project = await prisma.project.findFirst({
      where: { companyId: contractor!.id, locations: { some: { type: 'DELIVERY' } } },
      select: {
        id: true,
        locations: { where: { type: 'DELIVERY' }, select: { id: true }, take: 1 },
      },
    });
    expect(project).not.toBeNull();
    const deliveryLocationId = project!.locations[0]!.id;

    const material = await prisma.material.findFirst({ select: { id: true } });
    expect(material).not.toBeNull();

    const stamp = Date.now();
    const vendorRes = await authRequest('post', '/v1/companies', admin.accessToken)
      .send({
        type: 'VENDOR',
        legalName: `Portal Vendor ${stamp}`,
        contactEmail: `portal-vendor-${stamp}@for205.local`,
      })
      .expect(201);
    vendorId = vendorRes.body.data.id;

    const createRes = await authRequest('post', '/v1/rfqs', admin.accessToken)
      .send({
        projectId: project!.id,
        deliveryLocationId,
        deadlineEnd: '2026-12-01',
        vendorIds: [vendorId],
        lineItems: [{ materialId: material!.id, quantity: 5, uom: 'pcs', costCode: 'CC-205' }],
      })
      .expect(201);
    rfqId = createRes.body.data.id;

    // Move it to OPEN so quotes can be submitted.
    await authRequest('post', `/v1/rfqs/${rfqId}/send`, admin.accessToken).send({}).expect(200);

    const rfqVendor = await prisma.rfqVendor.findFirstOrThrow({
      where: { rfqId, vendorId },
      select: { id: true },
    });
    rfqVendorId = rfqVendor.id;

    const lineItem = await prisma.rfqLineItem.findFirstOrThrow({
      where: { rfqId },
      select: { id: true },
    });
    rfqLineItemId = lineItem.id;

    // Seed a downloadable attachment (signing is local — no MinIO round-trip).
    const file = await prisma.file.create({
      data: {
        bucket: 'forethread',
        key: `rfq-documents/${rfqId}/spec-${stamp}.pdf`,
        filename: 'spec.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        uploadedById: admin.userId,
      },
      select: { id: true },
    });
    fileId = file.id;
    await prisma.rfqDocument.create({ data: { rfqId, fileId: file.id } });
  });

  it('GET landing resolves the RFQ scope with a downloadable attachment URL', async () => {
    const token = await issueToken();
    const server = getHttpServer();

    const res = await request(server).get(`/v1/rfqs/invitation/${token}`).expect(200);

    expect(res.body.data.id).toBe(rfqId);
    expect(res.body.data.vendorId).toBe(vendorId);
    expect(res.body.data.lineItems).toHaveLength(1);
    expect(res.body.data.attachments).toHaveLength(1);
    expect(res.body.data.attachments[0].filename).toBe('spec.pdf');
    expect(res.body.data.attachments[0].url).toContain('spec-');
  });

  it('rejects a malformed / unknown token', async () => {
    await request(getHttpServer()).get('/v1/rfqs/invitation/not-a-real-token').expect(403);
  });

  it('POST submits a quote (persisted with payment terms) and BURNS the token', async () => {
    const token = await issueToken();
    const server = getHttpServer();

    // The landing page can be viewed without consuming the token.
    await request(server).get(`/v1/rfqs/invitation/${token}`).expect(200);

    const submitRes = await request(server)
      .post(`/v1/rfqs/invitation/${token}/quote`)
      .send({
        paymentTerms: 'Net 30',
        lineItems: [
          {
            rfqLineItemId,
            unitPrice: 12.5,
            quotedQuantity: 5,
            deliveryDate: '2026-07-01',
            notes: 'In stock',
          },
        ],
      })
      .expect(201);

    expect(submitRes.body.data.id).toBeTruthy();

    const quote = await prisma.quoteResponse.findFirstOrThrow({
      where: { rfqId, vendorId },
      select: { paymentTerms: true, status: true, lineItems: { select: { unitPrice: true } } },
    });
    expect(quote.status).toBe('SUBMITTED');
    expect(quote.paymentTerms).toBe('Net 30');
    expect(quote.lineItems.length).toBeGreaterThan(0);

    // Token is burned: the same token can no longer view or submit.
    await request(server).get(`/v1/rfqs/invitation/${token}`).expect(403);
    await request(server)
      .post(`/v1/rfqs/invitation/${token}/quote`)
      .send({ lineItems: [{ rfqLineItemId, unitPrice: 9, quotedQuantity: 1, deliveryDate: '2026-07-01' }] })
      .expect(403);
  });
});
