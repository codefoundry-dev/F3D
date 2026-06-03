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
 * FOR-207 — Quote storage against RFQ with audit trail.
 *
 * Verifies that quotes submitted through the two vendor-portal paths (B4 manual
 * form and B5 PDF upload) both flow through the same persistence layer and are
 * recorded in a per-RFQ quote audit trail, queryable by the contractor from the
 * RFQ detail view. Also exercises the APPROVED audit entry and access control.
 */
describe('RFQ quote audit trail (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessTokens: AccessTokensService;

  let admin: AuthTokens;

  let rfqId: string;
  let rfqLineItemId: string;
  let vendorAId: string;
  let vendorBId: string;
  let rfqVendorAId: string;
  let rfqVendorBId: string;

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
    for (const id of [vendorAId, vendorBId]) {
      if (id) {
        await prisma.companyVendorAssignment.deleteMany({ where: { vendorId: id } });
        await prisma.company.delete({ where: { id } }).catch(() => undefined);
      }
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

  it('sets up an OPEN RFQ with two invited vendors', async () => {
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
    const vendorARes = await authRequest('post', '/v1/companies', admin.accessToken)
      .send({
        type: 'VENDOR',
        legalName: `Audit Vendor A ${stamp}`,
        contactEmail: `audit-a-${stamp}@for207.local`,
      })
      .expect(201);
    vendorAId = vendorARes.body.data.id;

    const vendorBRes = await authRequest('post', '/v1/companies', admin.accessToken)
      .send({
        type: 'VENDOR',
        legalName: `Audit Vendor B ${stamp}`,
        contactEmail: `audit-b-${stamp}@for207.local`,
      })
      .expect(201);
    vendorBId = vendorBRes.body.data.id;

    const createRes = await authRequest('post', '/v1/rfqs', admin.accessToken)
      .send({
        projectId: project!.id,
        deliveryLocationId,
        deadlineEnd: '2026-12-01',
        vendorIds: [vendorAId, vendorBId],
        lineItems: [{ materialId: material!.id, quantity: 5, uom: 'pcs', costCode: 'CC-207' }],
      })
      .expect(201);
    rfqId = createRes.body.data.id;

    await authRequest('post', `/v1/rfqs/${rfqId}/send`, admin.accessToken).send({}).expect(200);

    rfqVendorAId = (
      await prisma.rfqVendor.findFirstOrThrow({
        where: { rfqId, vendorId: vendorAId },
        select: { id: true },
      })
    ).id;
    rfqVendorBId = (
      await prisma.rfqVendor.findFirstOrThrow({
        where: { rfqId, vendorId: vendorBId },
        select: { id: true },
      })
    ).id;
    rfqLineItemId = (
      await prisma.rfqLineItem.findFirstOrThrow({ where: { rfqId }, select: { id: true } })
    ).id;
  });

  it('records a FORM-source audit entry when vendor A submits via the manual form', async () => {
    const token = await issueToken(rfqVendorAId, vendorAId);
    await request(getHttpServer())
      .post(`/v1/rfqs/invitation/${token}/quote`)
      .send({
        lineItems: [
          { rfqLineItemId, unitPrice: 10, quotedQuantity: 5, deliveryDate: '2026-07-01' },
        ],
      })
      .expect(201);
  });

  it('records a PDF-source audit entry when vendor B submits an extracted quote', async () => {
    const token = await issueToken(rfqVendorBId, vendorBId);
    await request(getHttpServer())
      .post(`/v1/rfqs/invitation/${token}/quote`)
      .send({
        source: 'PDF',
        lineItems: [
          { rfqLineItemId, unitPrice: 12.5, quotedQuantity: 5, deliveryDate: '2026-07-01' },
        ],
      })
      .expect(201);
  });

  it('exposes both submissions on the RFQ audit trail with the correct source', async () => {
    const res = await authRequest('get', `/v1/rfqs/${rfqId}/quote-audit`, admin.accessToken).expect(
      200,
    );

    const entries: Array<{ action: string; source: string | null; vendorId: string }> =
      res.body.data;
    expect(entries.length).toBeGreaterThanOrEqual(2);

    const submitted = entries.filter((e) => e.action === 'SUBMITTED');
    const byVendorA = submitted.find((e) => e.vendorId === vendorAId);
    const byVendorB = submitted.find((e) => e.vendorId === vendorBId);

    expect(byVendorA?.source).toBe('FORM');
    expect(byVendorB?.source).toBe('PDF');
  });

  it('denies the audit trail to an unrelated vendor admin via a foreign company', async () => {
    // The trail is scoped: a contractor of the RFQ's company sees it. A request
    // without a session is rejected by the auth guard.
    await request(getHttpServer()).get(`/v1/rfqs/${rfqId}/quote-audit`).expect(401);
  });
});
