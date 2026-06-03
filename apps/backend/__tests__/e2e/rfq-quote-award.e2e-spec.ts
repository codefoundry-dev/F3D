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
 * FOR-209 — Award flow.
 *
 * Sets up an OPEN RFQ with two line items and one invited vendor, has the vendor
 * submit a quote, then awards that quote as the contractor. Verifies the award
 * endpoint approves the quote, marks the RFQ AWARDED, logs the decision on the
 * quote audit trail, and auto-creates a draft Purchase Order pre-filled with the
 * awarded quote's line items.
 */
describe('RFQ quote award (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessTokens: AccessTokensService;

  let admin: AuthTokens;

  let rfqId: string;
  let quoteId: string;
  let purchaseOrderId: string;
  let lineItemAId: string;
  let lineItemBId: string;
  let vendorId: string;
  let rfqVendorId: string;

  beforeAll(async () => {
    const ctx = await bootstrapTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    accessTokens = app.get(AccessTokensService);
    admin = await loginUser(SEED_USERS.companyAdmin.email, SEED_USERS.companyAdmin.password);
  });

  afterAll(async () => {
    if (purchaseOrderId) {
      // PoLineItem rows cascade on PurchaseOrder delete.
      await prisma.purchaseOrder.delete({ where: { id: purchaseOrderId } }).catch(() => undefined);
    }
    if (rfqId) {
      await prisma.quoteAudit.deleteMany({ where: { rfqId } });
      await prisma.quoteResponse.deleteMany({ where: { rfqId } });
      await prisma.accessToken.deleteMany({ where: { subjectId: rfqId } });
      await prisma.rfqVendor.deleteMany({ where: { rfqId } });
      await prisma.rfqLineItem.deleteMany({ where: { rfqId } });
      await prisma.rfq.delete({ where: { id: rfqId } }).catch(() => undefined);
    }
    if (vendorId) {
      await prisma.companyVendorAssignment.deleteMany({ where: { vendorId } });
      await prisma.company.delete({ where: { id: vendorId } }).catch(() => undefined);
    }
    await teardownTestApp();
  });

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

  it('sets up an OPEN RFQ with one invited vendor and a submitted quote', async () => {
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

    const materials = await prisma.material.findMany({ select: { id: true }, take: 2 });
    expect(materials.length).toBe(2);

    const stamp = Date.now();
    const vendorRes = await authRequest('post', '/v1/companies', admin.accessToken)
      .send({
        type: 'VENDOR',
        legalName: `Award Vendor ${stamp}`,
        contactEmail: `award-vendor-${stamp}@for209.local`,
      })
      .expect(201);
    vendorId = vendorRes.body.data.id;

    const createRes = await authRequest('post', '/v1/rfqs', admin.accessToken)
      .send({
        projectId: project!.id,
        deliveryLocationId,
        deadlineEnd: '2026-12-01',
        vendorIds: [vendorId],
        lineItems: [
          { materialId: materials[0]!.id, quantity: 5, uom: 'pcs', costCode: 'CC-209-A' },
          { materialId: materials[1]!.id, quantity: 4, uom: 'pcs', costCode: 'CC-209-B' },
        ],
      })
      .expect(201);
    rfqId = createRes.body.data.id;

    await authRequest('post', `/v1/rfqs/${rfqId}/send`, admin.accessToken).send({}).expect(200);

    const rfqVendor = await prisma.rfqVendor.findFirstOrThrow({
      where: { rfqId, vendorId },
      select: { id: true },
    });
    rfqVendorId = rfqVendor.id;

    const lineItems = await prisma.rfqLineItem.findMany({
      where: { rfqId },
      orderBy: { costCode: 'asc' },
      select: { id: true },
    });
    lineItemAId = lineItems[0]!.id;
    lineItemBId = lineItems[1]!.id;

    const token = await issueToken();
    await request(getHttpServer())
      .post(`/v1/rfqs/invitation/${token}/quote`)
      .send({
        lineItems: [
          {
            rfqLineItemId: lineItemAId,
            unitPrice: 10,
            quotedQuantity: 5,
            deliveryDate: '2026-07-01',
          },
          {
            rfqLineItemId: lineItemBId,
            unitPrice: 25,
            quotedQuantity: 4,
            deliveryDate: '2026-07-15',
          },
        ],
      })
      .expect(201);

    const quote = await prisma.quoteResponse.findFirstOrThrow({
      where: { rfqId, vendorId },
      select: { id: true, status: true },
    });
    quoteId = quote.id;
    expect(quote.status).toBe('SUBMITTED');
  });

  it('awards the quote and creates a draft PO pre-filled with the quoted line items', async () => {
    const res = await authRequest(
      'post',
      `/v1/rfqs/${rfqId}/quotes/${quoteId}/award`,
      admin.accessToken,
    ).expect(201);

    const data = res.body.data;
    expect(data.id).toBe(quoteId);
    expect(data.status).toBe('APPROVED');
    expect(data.purchaseOrderId).toBeTruthy();
    expect(data.poNumber).toMatch(/^PO-/);
    purchaseOrderId = data.purchaseOrderId;

    // The quote is approved and the RFQ is AWARDED.
    const quote = await prisma.quoteResponse.findUniqueOrThrow({
      where: { id: quoteId },
      select: { status: true },
    });
    expect(quote.status).toBe('APPROVED');

    const rfq = await prisma.rfq.findUniqueOrThrow({
      where: { id: rfqId },
      select: { status: true },
    });
    expect(rfq.status).toBe('AWARDED');

    // The award decision is logged on the RFQ's quote audit trail.
    const auditCount = await prisma.quoteAudit.count({
      where: { rfqId, quoteResponseId: quoteId, action: 'APPROVED' },
    });
    expect(auditCount).toBe(1);

    // A draft PO sourced from the RFQ exists, linked back to the RFQ and vendor.
    const po = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      select: {
        status: true,
        sourceOfCreation: true,
        rfqId: true,
        vendorId: true,
        lineItemCount: true,
        lineItems: {
          orderBy: { lineNumber: 'asc' },
          select: { quantityOrdered: true, unitPrice: true, lineTotal: true },
        },
      },
    });
    expect(po.status).toBe('DRAFT');
    expect(po.sourceOfCreation).toBe('RFQ');
    expect(po.rfqId).toBe(rfqId);
    expect(po.vendorId).toBe(vendorId);
    expect(po.lineItemCount).toBe(2);
    expect(po.lineItems).toHaveLength(2);
    expect(po.lineItems[0]!.quantityOrdered).toBe(5);
    expect(Number(po.lineItems[0]!.unitPrice)).toBe(10);
    expect(Number(po.lineItems[0]!.lineTotal)).toBe(50);
    expect(po.lineItems[1]!.quantityOrdered).toBe(4);
    expect(Number(po.lineItems[1]!.unitPrice)).toBe(25);
    expect(Number(po.lineItems[1]!.lineTotal)).toBe(100);
  });

  it('rejects awarding an already-awarded quote', async () => {
    await authRequest(
      'post',
      `/v1/rfqs/${rfqId}/quotes/${quoteId}/award`,
      admin.accessToken,
    ).expect(400);
  });

  it('rejects an unauthenticated award request', async () => {
    await request(getHttpServer()).post(`/v1/rfqs/${rfqId}/quotes/${quoteId}/award`).expect(401);
  });
});
