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
 * FOR-208 — Quote comparison view.
 *
 * Sets up an OPEN RFQ with two line items and three invited vendors, has each
 * vendor submit a quote, then verifies the contractor's side-by-side comparison
 * endpoint: one row per line item, one vendor column per quote, the lowest
 * extended cost per row flagged, and per-vendor column totals.
 */
describe('RFQ quote comparison (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessTokens: AccessTokensService;

  let admin: AuthTokens;

  let rfqId: string;
  let lineItemAId: string;
  let lineItemBId: string;
  const vendorIds: string[] = [];
  const rfqVendorIds: string[] = [];

  beforeAll(async () => {
    const ctx = await bootstrapTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    accessTokens = app.get(AccessTokensService);
    admin = await loginUser(SEED_USERS.companyAdmin.email, SEED_USERS.companyAdmin.password);
  });

  afterAll(async () => {
    if (rfqId) {
      await prisma.quoteAudit.deleteMany({ where: { rfqId } });
      await prisma.quoteResponse.deleteMany({ where: { rfqId } });
      await prisma.accessToken.deleteMany({ where: { subjectId: rfqId } });
      await prisma.rfqVendor.deleteMany({ where: { rfqId } });
      await prisma.rfqLineItem.deleteMany({ where: { rfqId } });
      await prisma.rfq.delete({ where: { id: rfqId } }).catch(() => undefined);
    }
    for (const id of vendorIds) {
      await prisma.companyVendorAssignment.deleteMany({ where: { vendorId: id } });
      await prisma.company.delete({ where: { id } }).catch(() => undefined);
    }
    await teardownTestApp();
  });

  async function issueToken(rfqVendorId: string, vendorId: string): Promise<string> {
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

  it('sets up an OPEN RFQ with two line items and three invited vendors', async () => {
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
    for (const letter of ['A', 'B', 'C']) {
      const res = await authRequest('post', '/v1/companies', admin.accessToken)
        .send({
          type: 'VENDOR',
          legalName: `Cmp Vendor ${letter} ${stamp}`,
          contactEmail: `cmp-${letter.toLowerCase()}-${stamp}@for208.local`,
        })
        .expect(201);
      vendorIds.push(res.body.data.id);
    }

    const createRes = await authRequest('post', '/v1/rfqs', admin.accessToken)
      .send({
        projectId: project!.id,
        deliveryLocationId,
        deadlineEnd: '2026-12-01',
        vendorIds,
        lineItems: [
          { materialId: materials[0]!.id, quantity: 5, uom: 'pcs', costCode: 'CC-208-A' },
          { materialId: materials[1]!.id, quantity: 4, uom: 'pcs', costCode: 'CC-208-B' },
        ],
      })
      .expect(201);
    rfqId = createRes.body.data.id;

    await authRequest('post', `/v1/rfqs/${rfqId}/send`, admin.accessToken).send({}).expect(200);

    for (const vendorId of vendorIds) {
      const rfqVendor = await prisma.rfqVendor.findFirstOrThrow({
        where: { rfqId, vendorId },
        select: { id: true },
      });
      rfqVendorIds.push(rfqVendor.id);
    }

    const lineItems = await prisma.rfqLineItem.findMany({
      where: { rfqId },
      orderBy: { costCode: 'asc' },
      select: { id: true },
    });
    lineItemAId = lineItems[0]!.id;
    lineItemBId = lineItems[1]!.id;
  });

  it('accepts three quotes with differing prices', async () => {
    // Vendor A: line A @ 10 (=50), line B @ 25 (=100)
    // Vendor B: line A @ 8  (=40, cheapest A), line B @ 30 (=120)
    // Vendor C: line A @ 12 (=60), line B @ 20 (=80, cheapest B)
    const prices = [
      { a: 10, b: 25 },
      { a: 8, b: 30 },
      { a: 12, b: 20 },
    ];

    for (let i = 0; i < vendorIds.length; i++) {
      const token = await issueToken(rfqVendorIds[i]!, vendorIds[i]!);
      await request(getHttpServer())
        .post(`/v1/rfqs/invitation/${token}/quote`)
        .send({
          lineItems: [
            {
              rfqLineItemId: lineItemAId,
              unitPrice: prices[i]!.a,
              quotedQuantity: 5,
              deliveryDate: '2026-07-01',
            },
            {
              rfqLineItemId: lineItemBId,
              unitPrice: prices[i]!.b,
              quotedQuantity: 4,
              deliveryDate: '2026-07-15',
            },
          ],
        })
        .expect(201);
    }
  });

  it('returns a comparison grid with lowest-price highlights and vendor totals', async () => {
    const res = await authRequest(
      'get',
      `/v1/rfqs/${rfqId}/quote-comparison`,
      admin.accessToken,
    ).expect(200);

    const data = res.body.data;
    expect(data.rfqId).toBe(rfqId);
    expect(data.vendors).toHaveLength(3);
    expect(data.rows).toHaveLength(2);

    const totalsByVendor = new Map<string, number>(
      data.vendors.map((v: { vendorId: string; total: number }) => [v.vendorId, v.total]),
    );
    expect(totalsByVendor.get(vendorIds[0]!)).toBe(150); // 50 + 100
    expect(totalsByVendor.get(vendorIds[1]!)).toBe(160); // 40 + 120
    expect(totalsByVendor.get(vendorIds[2]!)).toBe(140); // 60 + 80

    // Row A (qty 5): vendor B is cheapest at 40.
    const rowA = data.rows.find(
      (r: { rfqLineItemId: string }) => r.rfqLineItemId === lineItemAId,
    );
    expect(rowA.lowestVendorId).toBe(vendorIds[1]);
    const lowestCellA = rowA.cells.find((c: { isLowest: boolean }) => c.isLowest);
    expect(lowestCellA.extendedCost).toBe(40);

    // Row B (qty 4): vendor C is cheapest at 80.
    const rowB = data.rows.find(
      (r: { rfqLineItemId: string }) => r.rfqLineItemId === lineItemBId,
    );
    expect(rowB.lowestVendorId).toBe(vendorIds[2]);

    // Each vendor surfaces lead time + payment terms columns.
    expect(data.vendors.every((v: { leadTimeDate: string | null }) => v.leadTimeDate !== null)).toBe(
      true,
    );
  });

  it('rejects an unauthenticated request for the comparison', async () => {
    await request(getHttpServer()).get(`/v1/rfqs/${rfqId}/quote-comparison`).expect(401);
  });
});
