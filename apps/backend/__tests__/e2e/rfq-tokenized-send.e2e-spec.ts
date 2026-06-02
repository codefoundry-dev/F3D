import type { INestApplication } from '@nestjs/common';

import type { PrismaService } from '../../src/prisma/prisma.service';

import {
  AuthTokens,
  MockEmailService,
  authRequest,
  bootstrapTestApp,
  getHttpServer,
  loginUser,
  SEED_USERS,
  teardownTestApp,
} from './test-helpers';
import request from 'supertest';

/**
 * FOR-203 — RFQ multi-vendor tokenized send.
 *
 * Proves the send action end-to-end through the HTTP layer:
 *   • CC recipients are normalised and persisted on the RFQ.
 *   • Each invited vendor gets its OWN unique invitation token.
 *   • The Public guest endpoint resolves a token to ONLY that vendor's RFQ
 *     view — vendor A's token never reveals vendor B's identity.
 */
describe('RFQ tokenized send (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let emailService: MockEmailService;

  let admin: AuthTokens;

  const createdVendorIds: string[] = [];
  let rfqId: string;

  beforeAll(async () => {
    const ctx = await bootstrapTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    emailService = ctx.emailService;

    admin = await loginUser(SEED_USERS.companyAdmin.email, SEED_USERS.companyAdmin.password);
  });

  afterAll(async () => {
    // Clean up the RFQ + vendors this spec created.
    if (rfqId) {
      await prisma.rfqVendor.deleteMany({ where: { rfqId } });
      await prisma.rfqLineItem.deleteMany({ where: { rfqId } });
      await prisma.rfq.delete({ where: { id: rfqId } }).catch(() => undefined);
    }
    for (const vendorId of createdVendorIds) {
      await prisma.companyVendorAssignment.deleteMany({ where: { vendorId } });
      await prisma.company.delete({ where: { id: vendorId } }).catch(() => undefined);
    }
    await teardownTestApp();
  });

  /** Poll the DB until every invited vendor of the RFQ has an invitation token. */
  async function waitForTokens(id: string, expected: number): Promise<string[]> {
    for (let attempt = 0; attempt < 40; attempt++) {
      const rows = await prisma.rfqVendor.findMany({
        where: { rfqId: id },
        select: { invitationToken: true },
      });
      const tokens = rows.map((r) => r.invitationToken).filter((t): t is string => !!t);
      if (tokens.length >= expected) return tokens;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Timed out waiting for ${expected} invitation tokens on RFQ ${id}`);
  }

  it('sends an RFQ to 3 vendors → 3 distinct tokens → each vendor sees only their own RFQ', async () => {
    emailService.clear();

    // A TestCo project with a delivery location + a material to quote.
    const contractor = await prisma.company.findFirst({
      where: { abn: 'TEST-CONTRACTOR-001' },
      select: { id: true },
    });
    expect(contractor).not.toBeNull();

    const project = await prisma.project.findFirst({
      where: {
        companyId: contractor!.id,
        locations: { some: { type: 'DELIVERY' } },
      },
      select: {
        id: true,
        locations: { where: { type: 'DELIVERY' }, select: { id: true }, take: 1 },
      },
    });
    expect(project).not.toBeNull();
    const deliveryLocationId = project!.locations[0]!.id;

    const material = await prisma.material.findFirst({ select: { id: true } });
    expect(material).not.toBeNull();

    // Create 3 invitation-only vendors (no users → guest token flow), each
    // assigned to TestCo via the create-company endpoint.
    const stamp = Date.now();
    for (let i = 0; i < 3; i++) {
      const res = await authRequest('post', '/v1/companies', admin.accessToken)
        .send({
          type: 'VENDOR',
          legalName: `Tokenized Vendor ${i}-${stamp}`,
          contactEmail: `vendor-${i}-${stamp}@for203.local`,
        })
        .expect(201);
      createdVendorIds.push(res.body.data.id);
    }
    // Sanity: three DISTINCT vendor companies.
    expect(new Set(createdVendorIds).size).toBe(3);

    // Create the RFQ as a draft.
    const createRes = await authRequest('post', '/v1/rfqs', admin.accessToken)
      .send({
        projectId: project!.id,
        deliveryLocationId,
        deadlineEnd: '2026-12-01',
        vendorIds: createdVendorIds,
        lineItems: [{ materialId: material!.id, quantity: 7, uom: 'pcs', costCode: 'CC-203' }],
      })
      .expect(201);
    rfqId = createRes.body.data.id;
    expect(rfqId).toBeTruthy();

    // Send it with CC recipients (deliberately messy: duplicate + mixed case).
    await authRequest('post', `/v1/rfqs/${rfqId}/send`, admin.accessToken)
      .send({ cc: ['  Buyer@Acme.com ', 'buyer@acme.com', 'pm@acme.com'] })
      .expect(200);

    // CC is normalised + de-duplicated and persisted on the RFQ.
    const persisted = await prisma.rfq.findUnique({
      where: { id: rfqId },
      select: { ccEmails: true, status: true },
    });
    expect(persisted!.status).toBe('OPEN');
    expect(persisted!.ccEmails).toEqual(['buyer@acme.com', 'pm@acme.com']);

    // Token generation + notification is fire-and-forget → poll until ready.
    const tokens = await waitForTokens(rfqId, 3);

    // Exactly one unique token per vendor.
    expect(tokens).toHaveLength(3);
    expect(new Set(tokens).size).toBe(3);

    // Each vendor's token resolves ONLY to that vendor's RFQ view.
    const vendorRows = await prisma.rfqVendor.findMany({
      where: { rfqId },
      select: { vendorId: true, invitationToken: true },
    });

    const server = getHttpServer();
    for (const row of vendorRows) {
      const guest = await request(server)
        .get(`/v1/rfqs/invitation/${row.invitationToken}`)
        .expect(200);
      expect(guest.body.data.id).toBe(rfqId);
      // Isolation: the token reveals its OWN vendor, never a sibling vendor.
      expect(guest.body.data.vendorId).toBe(row.vendorId);
    }

    // A bogus token is rejected (no cross-vendor leakage).
    await request(server).get('/v1/rfqs/invitation/not-a-real-token').expect(404);
  });
});
