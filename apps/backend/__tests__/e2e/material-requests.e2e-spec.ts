import type { INestApplication } from '@nestjs/common';
import { PoSourceOfCreation, PoStatus, RfqStatus } from '@prisma/client';

import type { PrismaService } from '../../src/prisma/prisma.service';

import {
  AuthTokens,
  authRequest,
  bootstrapTestApp,
  loginUser,
  SEED_USERS,
  teardownTestApp,
} from './test-helpers';

/**
 * Material Request loop (e2e) — Week-3 procurement bug bash.
 *
 * Exercises the Release-1 Material Request lifecycle end-to-end against a real
 * DB: a Procurement Officer raises + submits an MR, a Company Admin reviews it
 * from the queue and either approves → converts (to a draft RFQ or a draft PO)
 * or declines with a reason. Asserts the produced RFQ/PO records, the MR status
 * transitions + conversion linkage, the audit trail, and permission/state guards.
 *
 * This is the integration coverage the unit specs mock away — it is the only
 * test that runs the MR → RFQ/PO conversion seams (the newest, least-integrated
 * leg of the loop) through the real persistence layer.
 */
describe('Material Request loop (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let officer: AuthTokens; // procurement officer — raises + submits MRs
  let admin: AuthTokens; // company admin — approves / declines / converts
  let finance: AuthTokens; // financial officer — list+read only (gating checks)

  let projectId: string;
  let deliveryLocationId: string;
  let vendorId: string;

  const mrIds: string[] = [];
  let createdRfqId: string | undefined;
  let createdPoId: string | undefined;

  /** Raise + submit an MR as the officer; returns the created MR detail body. */
  async function raiseSubmittedMr(
    overrides: Record<string, unknown> = {},
  ): Promise<Record<string, any>> {
    const res = await authRequest('post', '/v1/material-requests', officer.accessToken)
      .send({
        projectId,
        priority: 'HIGH',
        neededByDate: '2026-12-31',
        deliveryLocationId,
        note: 'Bug-bash material request',
        submit: true,
        lineItems: [
          {
            materialName: 'Framing Lumber 2x4',
            description: 'Kiln-dried',
            quantity: 25,
            unit: 'pcs',
          },
          { materialName: 'Drywall Sheet 4x8', quantity: 10, unit: 'sheet' },
        ],
        ...overrides,
      })
      .expect(201);
    const mr = res.body.data;
    mrIds.push(mr.id);
    return mr;
  }

  beforeAll(async () => {
    const ctx = await bootstrapTestApp();
    app = ctx.app;
    prisma = ctx.prisma;

    officer = await loginUser(
      SEED_USERS.procurementOfficer.email,
      SEED_USERS.procurementOfficer.password,
    );
    admin = await loginUser(SEED_USERS.companyAdmin.email, SEED_USERS.companyAdmin.password);
    finance = await loginUser(
      SEED_USERS.financialOfficer.email,
      SEED_USERS.financialOfficer.password,
    );

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
    projectId = project!.id;
    deliveryLocationId = project!.locations[0]!.id;

    // A vendor company to address the converted PO to (convert-to-po needs a vendorId).
    const stamp = Date.now();
    const vendorRes = await authRequest('post', '/v1/companies', admin.accessToken)
      .send({
        type: 'VENDOR',
        legalName: `MR Bug-bash Vendor ${stamp}`,
        contactEmail: `mr-bugbash-vendor-${stamp}@for208.local`,
      })
      .expect(201);
    vendorId = vendorRes.body.data.id;
  });

  afterAll(async () => {
    // FK-safe order: MRs first (clears convertedTo* refs + cascades line items),
    // then the orphaned RFQ/PO, then the vendor company.
    if (mrIds.length) {
      await prisma.materialRequest
        .deleteMany({ where: { id: { in: mrIds } } })
        .catch(() => undefined);
      await prisma.auditLog
        .deleteMany({ where: { targetType: 'MaterialRequest', targetId: { in: mrIds } } })
        .catch(() => undefined);
    }
    if (createdRfqId) {
      await prisma.rfq.delete({ where: { id: createdRfqId } }).catch(() => undefined);
    }
    if (createdPoId) {
      await prisma.purchaseOrder.delete({ where: { id: createdPoId } }).catch(() => undefined);
    }
    if (vendorId) {
      await prisma.companyVendorAssignment
        .deleteMany({ where: { vendorId } })
        .catch(() => undefined);
      await prisma.company.delete({ where: { id: vendorId } }).catch(() => undefined);
    }
    await teardownTestApp();
  });

  // ── Raise + queue ───────────────────────────────────────────────────────────

  it('officer raises + submits an MR that surfaces in the admin awaiting-approval queue', async () => {
    const mr = await raiseSubmittedMr();
    expect(mr.status).toBe('SUBMITTED');
    expect(mr.mrNumber).toMatch(/^MR-/);
    expect(mr.lineItems).toHaveLength(2);

    // Admin sees it via the US 2.08 "Requests awaiting approval" quick filter.
    const listRes = await authRequest('get', '/v1/material-requests', admin.accessToken)
      .query({ awaitingApproval: true })
      .expect(200);
    const ids = listRes.body.data.items.map((i: { id: string }) => i.id);
    expect(ids).toContain(mr.id);

    // Admin can open the detail.
    const detailRes = await authRequest(
      'get',
      `/v1/material-requests/${mr.id}`,
      admin.accessToken,
    ).expect(200);
    expect(detailRes.body.data.id).toBe(mr.id);
    expect(detailRes.body.data.requestedBy.email).toBe(SEED_USERS.procurementOfficer.email);
    expect(detailRes.body.data.lineItems).toHaveLength(2);
  });

  // ── Approve → convert to RFQ ──────────────────────────────────────────────────

  it('admin approves an MR and converts it to a draft RFQ with the line items copied', async () => {
    const mr = await raiseSubmittedMr();

    const approveRes = await authRequest(
      'post',
      `/v1/material-requests/${mr.id}/approve`,
      admin.accessToken,
    ).expect(200);
    expect(approveRes.body.data.status).toBe('APPROVED');

    const convertRes = await authRequest(
      'post',
      `/v1/material-requests/${mr.id}/convert-to-rfq`,
      admin.accessToken,
    )
      .send({ name: 'RFQ from bug-bash MR' })
      .expect(201);
    createdRfqId = convertRes.body.data.rfqId;
    expect(createdRfqId).toBeDefined();
    expect(convertRes.body.data.rfqNumber).toMatch(/^RFQ-/);

    // The persisted RFQ is a DRAFT with the MR's lines + project.
    const rfq = await prisma.rfq.findUnique({
      where: { id: createdRfqId },
      include: { lineItems: true },
    });
    expect(rfq).not.toBeNull();
    expect(rfq!.status).toBe(RfqStatus.DRAFT);
    expect(rfq!.projectId).toBe(projectId);
    expect(rfq!.lineItems).toHaveLength(2);
    expect(rfq!.lineItems.map((li) => li.materialName)).toEqual(
      expect.arrayContaining(['Framing Lumber 2x4', 'Drywall Sheet 4x8']),
    );

    // The MR is now CONVERTED and links back to the RFQ.
    const mrAfter = await authRequest(
      'get',
      `/v1/material-requests/${mr.id}`,
      admin.accessToken,
    ).expect(200);
    expect(mrAfter.body.data.status).toBe('CONVERTED');
    expect(mrAfter.body.data.convertedToRfq.id).toBe(createdRfqId);
  });

  // ── Approve → convert to PO ───────────────────────────────────────────────────

  it('admin converts an approved MR to a draft PO (MATERIAL_REQUEST source, zero prices)', async () => {
    const mr = await raiseSubmittedMr();
    await authRequest('post', `/v1/material-requests/${mr.id}/approve`, admin.accessToken).expect(
      200,
    );

    const convertRes = await authRequest(
      'post',
      `/v1/material-requests/${mr.id}/convert-to-po`,
      admin.accessToken,
    )
      .send({ vendorId })
      .expect(201);
    createdPoId = convertRes.body.data.poId;
    expect(createdPoId).toBeDefined();
    expect(convertRes.body.data.poNumber).toMatch(/^PO-/);

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: createdPoId },
      include: { lineItems: true },
    });
    expect(po).not.toBeNull();
    expect(po!.status).toBe(PoStatus.DRAFT);
    expect(po!.sourceOfCreation).toBe(PoSourceOfCreation.MATERIAL_REQUEST);
    expect(po!.vendorId).toBe(vendorId);
    expect(po!.lineItems).toHaveLength(2);
    // No pricing carried from the MR — filled in during PO edit.
    expect(po!.lineItems.every((li) => Number(li.unitPrice) === 0)).toBe(true);

    const mrAfter = await authRequest(
      'get',
      `/v1/material-requests/${mr.id}`,
      admin.accessToken,
    ).expect(200);
    expect(mrAfter.body.data.status).toBe('CONVERTED');
    expect(mrAfter.body.data.convertedToPo.id).toBe(createdPoId);
  });

  // ── Decline ───────────────────────────────────────────────────────────────────

  it('admin declines a submitted MR with a reason that is stored + surfaced', async () => {
    const mr = await raiseSubmittedMr();

    const declineRes = await authRequest(
      'post',
      `/v1/material-requests/${mr.id}/decline`,
      admin.accessToken,
    )
      .send({ reason: 'Sufficient stock already on site' })
      .expect(200);
    expect(declineRes.body.data.status).toBe('DECLINED');
    expect(declineRes.body.data.declineReason).toBe('Sufficient stock already on site');
    expect(declineRes.body.data.reviewedBy.email).toBe(SEED_USERS.companyAdmin.email);
  });

  // ── Audit trail ─────────────────────────────────────────────────────────────

  it('records the full lifecycle on the MR audit trail in order', async () => {
    const mr = await raiseSubmittedMr();
    await authRequest('post', `/v1/material-requests/${mr.id}/approve`, admin.accessToken).expect(
      200,
    );
    const convertRes = await authRequest(
      'post',
      `/v1/material-requests/${mr.id}/convert-to-rfq`,
      admin.accessToken,
    ).expect(201);
    // Track for teardown (this is a second converted RFQ).
    const auditRfqId = convertRes.body.data.rfqId as string;

    const auditRes = await authRequest(
      'get',
      `/v1/material-requests/${mr.id}/audit`,
      admin.accessToken,
    ).expect(200);
    const actions = auditRes.body.data.map((e: { action: string }) => e.action);
    expect(actions).toEqual([
      'MATERIAL_REQUEST_CREATED',
      'MATERIAL_REQUEST_SUBMITTED',
      'MATERIAL_REQUEST_APPROVED',
      'MATERIAL_REQUEST_CONVERTED',
    ]);
    const converted = auditRes.body.data.find(
      (e: { action: string }) => e.action === 'MATERIAL_REQUEST_CONVERTED',
    );
    expect(converted.metadata.target).toBe('RFQ');
    expect(converted.performedBy.email).toBe(SEED_USERS.companyAdmin.email);

    await prisma.rfq.delete({ where: { id: auditRfqId } }).catch(() => undefined);
  });

  // ── State + permission guards ─────────────────────────────────────────────────

  it('rejects converting an MR that is not APPROVED', async () => {
    const mr = await raiseSubmittedMr(); // still SUBMITTED
    await authRequest('post', `/v1/material-requests/${mr.id}/convert-to-rfq`, admin.accessToken)
      .send({})
      .expect(400);
  });

  it('rejects a decline with no reason', async () => {
    const mr = await raiseSubmittedMr();
    await authRequest('post', `/v1/material-requests/${mr.id}/decline`, admin.accessToken)
      .send({})
      .expect(400);
  });

  it('forbids a financial officer (list/read only) from creating or approving MRs', async () => {
    // Finance can read the queue…
    await authRequest('get', '/v1/material-requests', finance.accessToken)
      .query({ awaitingApproval: true })
      .expect(200);

    // …but cannot raise one (no materialRequest.create).
    await authRequest('post', '/v1/material-requests', finance.accessToken)
      .send({
        projectId,
        submit: true,
        lineItems: [{ materialName: 'X', quantity: 1, unit: 'pcs' }],
      })
      .expect(403);

    // …and cannot approve (no materialRequest.approve).
    const mr = await raiseSubmittedMr();
    await authRequest('post', `/v1/material-requests/${mr.id}/approve`, finance.accessToken).expect(
      403,
    );
  });
});
