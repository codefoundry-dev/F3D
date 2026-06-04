import type { INestApplication } from '@nestjs/common';
import { CompanyType, LocationType, PoStatus, UserRole, UserStatus } from '@prisma/client';

import type { PrismaService } from '../../src/prisma/prisma.service';

import {
  AuthTokens,
  authRequest,
  bootstrapTestApp,
  loginUser,
  MockEmailService,
  SEED_USERS,
  teardownTestApp,
} from './test-helpers';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * FOR-211 — PO PDF template polished + sent via Resend.
 *
 * Acceptance criterion under test:
 *   "E2E test: send PO → vendor receives email with valid PDF."
 *
 * The send action is `POST /v1/purchase-orders/:id/issue`. For a SUPER_ADMIN the
 * approval gate (FOR-210) is bypassed, so a DRAFT PO is issued directly
 * (DRAFT → SENT) and the vendor is notified. `PoStatusService.notifyVendorOfPo`
 * renders the polished PO PDF (`PoExportService.generatePoPdfBuffer`) and hands it
 * to `EmailService.sendPoIssuedEmail` as an attachment.
 *
 * The notify call is fire-and-forget, so after the HTTP response we poll the
 * captured-email buffer until the (async) PDF render + dispatch settles, then
 * assert the vendor's email carries a real PDF (magic `%PDF-` header).
 */
describe('PO issue → vendor email with PDF (FOR-211, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let emailService: MockEmailService;

  let superAdmin: AuthTokens;

  let vendorCompanyId: string;
  let vendorUserId: string;
  let vendorEmail: string;
  let poId: string;
  let poNumber: string;

  beforeAll(async () => {
    const ctx = await bootstrapTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    emailService = ctx.emailService;

    superAdmin = await loginUser(SEED_USERS.superAdmin.email, SEED_USERS.superAdmin.password);

    // Buyer side: an existing seeded contractor + one of its users + a project
    // with a delivery location.
    const contractor = await prisma.company.findFirst({ where: { type: CompanyType.CONTRACTOR } });
    if (!contractor) {
      throw new Error('Test seed missing — expected at least one CONTRACTOR company.');
    }

    const buyerUser = await prisma.user.findFirst({
      where: { companyId: contractor.id },
      select: { id: true },
    });
    if (!buyerUser) {
      throw new Error('Test seed missing — expected at least one user in the contractor company.');
    }

    const project = await prisma.project.findFirst({
      where: { companyId: contractor.id, locations: { some: { type: LocationType.DELIVERY } } },
      select: {
        id: true,
        locations: { where: { type: LocationType.DELIVERY }, select: { id: true }, take: 1 },
      },
    });
    if (!project || project.locations.length === 0) {
      throw new Error('Test seed missing — expected a contractor project with a delivery location.');
    }
    const deliveryLocationId = project.locations[0].id;

    // Vendor side: a fresh vendor company with a VENDOR-role recipient. The issue
    // flow notifies `vendor.users` filtered to role VENDOR.
    const stamp = Date.now();
    const vendor = await prisma.company.create({
      data: { type: CompanyType.VENDOR, legalName: `FOR-211 Vendor ${stamp}` },
      select: { id: true },
    });
    vendorCompanyId = vendor.id;
    vendorEmail = `for211-vendor-${stamp}@vendor.local`;
    const vendorUser = await prisma.user.create({
      data: {
        email: vendorEmail,
        name: 'FOR-211 Vendor Contact',
        role: UserRole.VENDOR,
        companyId: vendorCompanyId,
        status: UserStatus.ACTIVE,
      },
      select: { id: true },
    });
    vendorUserId = vendorUser.id;

    // A complete DRAFT PO so the PDF renders with line items + a delivery row.
    poNumber = `PO-FOR211-${stamp}`;
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        companyId: contractor.id,
        vendorId: vendorCompanyId,
        projectId: project.id,
        deliveryLocationId,
        createdByUserId: buyerUser.id,
        status: PoStatus.DRAFT,
        currency: 'AUD',
        subtotal: 1500,
        totalAmount: 1500,
        paymentTermsDays: 30,
        lineItemCount: 2,
        totalRequestedQty: 3,
        lineItems: {
          create: [
            {
              lineNumber: 1,
              quantityOrdered: 2,
              unitOfMeasure: 'EA',
              unitPrice: 500,
              lineTotal: 1000,
              description: 'Structural fixings',
            },
            {
              lineNumber: 2,
              quantityOrdered: 1,
              unitOfMeasure: 'EA',
              unitPrice: 500,
              lineTotal: 500,
              description: 'Delivery surcharge',
            },
          ],
        },
        deliveries: {
          create: [
            {
              sequence: 1,
              deliveryLocationId,
              deliveryDate: new Date('2026-07-01T00:00:00.000Z'),
              notes: 'First drop',
            },
          ],
        },
      },
      select: { id: true },
    });
    poId = po.id;
  });

  afterAll(async () => {
    if (poId) {
      // Cascades to line items + deliveries.
      await prisma.purchaseOrder.delete({ where: { id: poId } }).catch(() => undefined);
    }
    if (vendorUserId) {
      await prisma.user.delete({ where: { id: vendorUserId } }).catch(() => undefined);
    }
    if (vendorCompanyId) {
      await prisma.company.delete({ where: { id: vendorCompanyId } }).catch(() => undefined);
    }
    await teardownTestApp();
  });

  it('issues a DRAFT PO directly (→ SENT) and emails the vendor a valid PDF', async () => {
    emailService.clear();

    const res = await authRequest(
      'post',
      `/v1/purchase-orders/${poId}/issue`,
      superAdmin.accessToken,
    );
    expect([200, 201]).toContain(res.status);

    // The PO is now issued to the vendor.
    const after = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { status: true, issuedAt: true },
    });
    expect(after?.status).toBe(PoStatus.SENT);
    expect(after?.issuedAt).not.toBeNull();

    // notifyVendorOfPo is fire-and-forget: poll until the async PDF render +
    // dispatch lands the captured email.
    let email = emailService.getLastEmailTo(vendorEmail);
    for (let i = 0; i < 40 && !email; i += 1) {
      await sleep(50);
      email = emailService.getLastEmailTo(vendorEmail);
    }

    expect(email).toBeDefined();
    expect(email?.subject).toContain(poNumber);

    // A single PDF attachment named after the PO, with real PDF bytes.
    expect(email?.attachments).toHaveLength(1);
    const attachment = email!.attachments![0];
    expect(attachment.filename).toBe(`PO-${poNumber}.pdf`);
    expect(Buffer.isBuffer(attachment.content)).toBe(true);
    expect(attachment.content!.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    // Sanity: a rendered PO is more than a stub.
    expect(attachment.content!.length).toBeGreaterThan(1000);
  });

  it('does not re-issue an already-SENT PO', async () => {
    emailService.clear();

    const res = await authRequest(
      'post',
      `/v1/purchase-orders/${poId}/issue`,
      superAdmin.accessToken,
    );
    expect(res.status).toBe(400);
    expect(emailService.getLastEmailTo(vendorEmail)).toBeUndefined();
  });
});
