import type { INestApplication } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';

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

/**
 * FOR-203 — RFQ multi-vendor tokenized send.
 *
 * Proves the send action end-to-end through the HTTP layer:
 *   • CC recipients are normalised and persisted on the RFQ.
 *   • Each invited vendor gets its OWN A15 invitation token (delivered in the
 *     email link, never stored in plaintext).
 *   • The Public guest endpoint resolves a token to ONLY that vendor's RFQ
 *     view — vendor A's token never reveals vendor B's identity.
 */
describe('RFQ tokenized send (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let emailService: MockEmailService;

  let admin: AuthTokens;

  const vendors: { id: string; email: string }[] = [];
  const createdUserIds: string[] = [];
  let rfqId: string;

  beforeAll(async () => {
    const ctx = await bootstrapTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    emailService = ctx.emailService;

    admin = await loginUser(SEED_USERS.companyAdmin.email, SEED_USERS.companyAdmin.password);
  });

  afterAll(async () => {
    if (rfqId) {
      await prisma.accessToken.deleteMany({ where: { subjectId: rfqId } });
      await prisma.rfqVendor.deleteMany({ where: { rfqId } });
      await prisma.rfqLineItem.deleteMany({ where: { rfqId } });
      await prisma.rfq.delete({ where: { id: rfqId } }).catch(() => undefined);
    }
    for (const userId of createdUserIds) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    for (const vendor of vendors) {
      await prisma.companyVendorAssignment.deleteMany({ where: { vendorId: vendor.id } });
      await prisma.company.delete({ where: { id: vendor.id } }).catch(() => undefined);
    }
    await teardownTestApp();
  });

  /**
   * Token generation + email send is fire-and-forget. Poll the mock mailbox
   * until every invited vendor has received an `/invitation/<token>` link, then
   * return an email → token map.
   */
  async function waitForInvitationLinks(emails: string[]): Promise<Map<string, string>> {
    for (let attempt = 0; attempt < 40; attempt++) {
      const map = new Map<string, string>();
      for (const sent of emailService.sentEmails) {
        if (sent.url?.includes('/invitation/')) {
          map.set(sent.to, sent.url.split('/invitation/')[1]);
        }
      }
      if (emails.every((email) => map.has(email))) return map;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Timed out waiting for invitation links for ${emails.join(', ')}`);
  }

  it('sends an RFQ to 3 vendors → 3 distinct tokens → each vendor sees only their own RFQ', async () => {
    emailService.clear();

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

    // Create 3 invitation-only vendors, each with a single non-active (INVITED)
    // user → the send path emails them a guest `/invitation/<token>` link.
    const stamp = Date.now();
    for (let i = 0; i < 3; i++) {
      const email = `vendor-${i}-${stamp}@for203.local`;
      const res = await authRequest('post', '/v1/companies', admin.accessToken)
        .send({ type: 'VENDOR', legalName: `Tokenized Vendor ${i}-${stamp}`, contactEmail: email })
        .expect(201);
      const id = res.body.data.id;
      vendors.push({ id, email });

      const user = await prisma.user.create({
        data: {
          email,
          name: `Vendor Contact ${i}`,
          role: UserRole.VENDOR,
          status: UserStatus.INVITED,
          companyId: id,
        },
        select: { id: true },
      });
      createdUserIds.push(user.id);
    }
    expect(new Set(vendors.map((v) => v.id)).size).toBe(3);

    // Create the RFQ as a draft.
    const createRes = await authRequest('post', '/v1/rfqs', admin.accessToken)
      .send({
        projectId: project!.id,
        deliveryLocationId,
        deadlineEnd: '2026-12-01',
        vendorIds: vendors.map((v) => v.id),
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

    // Each vendor receives its own invitation link.
    const linkByEmail = await waitForInvitationLinks(vendors.map((v) => v.email));
    const tokens = vendors.map((v) => linkByEmail.get(v.email)!);
    expect(tokens).toHaveLength(3);
    expect(new Set(tokens).size).toBe(3);

    // Each vendor's token resolves ONLY to that vendor's RFQ view.
    const server = getHttpServer();
    for (const vendor of vendors) {
      const token = linkByEmail.get(vendor.email)!;
      const guest = await request(server).get(`/v1/rfqs/invitation/${token}`).expect(200);
      expect(guest.body.data.id).toBe(rfqId);
      // Isolation: the token reveals its OWN vendor, never a sibling vendor.
      expect(guest.body.data.vendorId).toBe(vendor.id);
    }

    // A bogus token is rejected (403 from the access-token guard, no leakage).
    await request(server).get('/v1/rfqs/invitation/not-a-real-token').expect(403);
  });
});
