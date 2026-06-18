import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CompanyType,
  DamageDisposition,
  DamageType,
  DeliveryOutcome,
  DeliveryReportStatus,
  LocationType,
  PoStatus,
  ProjectStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Epic 6 — Delivery approval close-out (the A7 crux).
 *
 * Acceptance criteria under test:
 *   • Approving a SUBMITTED delivery report advances the PO (its line
 *     `quantityDelivered` rises by the per-line received delta) AND pushes that
 *     same delta into the inventory `stockBalance` for each (material, location).
 *   • Rejecting a SUBMITTED delivery report touches NEITHER the PO nor inventory
 *     — it only stamps REJECTED + the rejection reason on the report.
 *
 * Strategy: spin up the real Nest app, mint a JWT directly to bypass OTP, and
 * seed a self-contained CONTRACTOR company (+ admin user, project, delivery
 * location, catalogue materials, deliverable POs with material-bearing line
 * items) at the database layer with a unique per-run suffix. Then exercise the
 * internal close-out over HTTP:
 *   POST  /v1/delivery-reports          → create a SUBMITTED report
 *   PATCH /v1/delivery-reports/:id/approve
 *   PATCH /v1/delivery-reports/:id/reject  { reason }
 * asserting both the HTTP response and the resulting DB state via Prisma.
 *
 * The COMPANY_ADMIN role already carries every `delivery.*` permission in the
 * catalog, and PermissionsBootstrap (OnModuleInit) materialises those grants on
 * `app.init()`, so — unlike the threshold suite's `po.approve` provisioning — no
 * manual grant seeding is required here.
 */
describe('Delivery approval close-out (Epic 6 A7, e2e)', () => {
  const SUFFIX = Date.now().toString().slice(-9);

  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  let companyId: string;
  let adminUserId: string;
  let adminToken: string;
  let projectId: string;
  let locationId: string;
  let categoryId: string;
  let materialAId: string;
  let materialBId: string;

  // Track everything we create so afterAll can tear it down without touching
  // unrelated seed data in the shared dev DB.
  const createdReportIds: string[] = [];
  const createdPoIds: string[] = [];

  async function mintToken(user: {
    id: string;
    email: string;
    role: UserRole;
    companyId: string | null;
  }): Promise<string> {
    return jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });
  }

  /** Seed a deliverable PO with two material-bearing line items at `status`. */
  async function seedDeliverablePo(
    status: PoStatus,
    lineA: { materialId: string; quantityOrdered: number },
    lineB: { materialId: string; quantityOrdered: number },
  ): Promise<{ poId: string; lineAId: string; lineBId: string }> {
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-DRA-${SUFFIX}-${createdPoIds.length + 1}`,
        companyId,
        projectId,
        deliveryLocationId: locationId,
        createdByUserId: adminUserId,
        status,
        currency: 'AUD',
        lineItemCount: 2,
        totalRequestedQty: lineA.quantityOrdered + lineB.quantityOrdered,
        lineItems: {
          create: [
            {
              lineNumber: 1,
              materialId: lineA.materialId,
              quantityOrdered: lineA.quantityOrdered,
              unitOfMeasure: 'unit',
              unitPrice: 10,
              lineTotal: 10 * lineA.quantityOrdered,
              description: 'Delivery line A',
            },
            {
              lineNumber: 2,
              materialId: lineB.materialId,
              quantityOrdered: lineB.quantityOrdered,
              unitOfMeasure: 'unit',
              unitPrice: 20,
              lineTotal: 20 * lineB.quantityOrdered,
              description: 'Delivery line B',
            },
          ],
        },
      },
      select: { id: true, lineItems: { orderBy: { lineNumber: 'asc' }, select: { id: true } } },
    });
    createdPoIds.push(po.id);
    return { poId: po.id, lineAId: po.lineItems[0].id, lineBId: po.lineItems[1].id };
  }

  /** Current on-hand for a (material, location), or 0 when no balance row exists. */
  async function onHand(materialId: string): Promise<number> {
    const bal = await prisma.stockBalance.findUnique({
      where: { materialId_locationId: { materialId, locationId } },
      select: { onHand: true },
    });
    return bal?.onHand ?? 0;
  }

  const auth = (token: string) => (method: 'get' | 'put' | 'patch' | 'post', url: string) =>
    request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({
      type: require('@nestjs/common').VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new (require('@nestjs/common').ValidationPipe)({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    jwt = moduleFixture.get(JwtService);

    // Self-contained CONTRACTOR company + admin so the fixture never collides
    // with (or depends on) the shared seed companies.
    const company = await prisma.company.create({
      data: {
        type: CompanyType.CONTRACTOR,
        legalName: `Delivery E2E Contractor ${SUFFIX}`,
        abn: `DRA-${SUFFIX}`,
      },
      select: { id: true },
    });
    companyId = company.id;

    const admin = await prisma.user.create({
      data: {
        email: `delivery-admin-${SUFFIX}@for-e2e.local`,
        name: 'Delivery E2E Admin',
        role: UserRole.COMPANY_ADMIN,
        companyId,
        status: UserStatus.ACTIVE,
      },
      select: { id: true, email: true, role: true, companyId: true },
    });
    adminUserId = admin.id;
    adminToken = await mintToken(admin);

    const project = await prisma.project.create({
      data: {
        name: `Delivery E2E Project ${SUFFIX}`,
        status: ProjectStatus.ONGOING,
        companyId,
        createdByUserId: adminUserId,
        locations: {
          create: {
            type: LocationType.DELIVERY,
            label: 'Delivery E2E site',
            address: '1 Delivery St',
            isDefault: true,
          },
        },
      },
      select: { id: true, locations: { select: { id: true } } },
    });
    projectId = project.id;
    locationId = project.locations[0].id;

    // A dedicated category + two catalogue materials so the approval close-out
    // resolves a material per PO line and pushes stock into inventory.
    const category = await prisma.materialCategory.create({
      data: { name: `Delivery E2E Category ${SUFFIX}` },
      select: { id: true },
    });
    categoryId = category.id;

    const materialA = await prisma.material.create({
      data: {
        name: `Delivery E2E Material A ${SUFFIX}`,
        categoryId,
        uom: 'unit',
        sku: `DRA-A-${SUFFIX}`,
        createdById: adminUserId,
      },
      select: { id: true },
    });
    materialAId = materialA.id;

    const materialB = await prisma.material.create({
      data: {
        name: `Delivery E2E Material B ${SUFFIX}`,
        categoryId,
        uom: 'unit',
        sku: `DRA-B-${SUFFIX}`,
        createdById: adminUserId,
      },
      select: { id: true },
    });
    materialBId = materialB.id;
  });

  afterAll(async () => {
    // Children first (FK order), all scoped to this run's fixture.
    for (const reportId of createdReportIds) {
      await prisma.deliveryReportLine.deleteMany({ where: { deliveryReportId: reportId } });
    }
    await prisma.deliveryReport
      .deleteMany({ where: { id: { in: createdReportIds } } })
      .catch(() => undefined);

    await prisma.stockMovement.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.stockBalance.deleteMany({ where: { companyId } }).catch(() => undefined);

    for (const poId of createdPoIds) {
      await prisma.poLineItem.deleteMany({ where: { purchaseOrderId: poId } });
    }
    await prisma.purchaseOrder
      .deleteMany({ where: { id: { in: createdPoIds } } })
      .catch(() => undefined);

    await prisma.auditLog
      .deleteMany({ where: { performedById: adminUserId } })
      .catch(() => undefined);

    await prisma.material
      .deleteMany({ where: { id: { in: [materialAId, materialBId] } } })
      .catch(() => undefined);
    await prisma.materialCategory.delete({ where: { id: categoryId } }).catch(() => undefined);
    await prisma.projectLocation.deleteMany({ where: { projectId } }).catch(() => undefined);
    await prisma.project.delete({ where: { id: projectId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: adminUserId } }).catch(() => undefined);
    await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);

    await app.close();
  });

  it('approving a delivery report advances the PO and pushes stock into inventory', async () => {
    // Line A: 10 ordered, all 10 delivered (DELIVERED → delta 10).
    // Line B: 8 ordered, 8 received but 3 damaged + RETURNED (delta 8 − 3 = 5).
    const { poId, lineAId, lineBId } = await seedDeliverablePo(
      PoStatus.ACCEPTED,
      { materialId: materialAId, quantityOrdered: 10 },
      { materialId: materialBId, quantityOrdered: 8 },
    );

    const beforeA = await onHand(materialAId);
    const beforeB = await onHand(materialBId);

    // Create the SUBMITTED report over HTTP.
    const createRes = await auth(adminToken)('post', '/v1/delivery-reports').send({
      purchaseOrderId: poId,
      deliveryLocationId: locationId,
      projectId,
      lines: [
        { poLineItemId: lineAId, quantityReceived: 10, outcome: DeliveryOutcome.DELIVERED },
        {
          poLineItemId: lineBId,
          quantityReceived: 8,
          outcome: DeliveryOutcome.DAMAGED,
          damagedQuantity: 3,
          damageType: DamageType.IN_TRANSIT,
          damageDisposition: DamageDisposition.RETURNED,
        },
      ],
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe(DeliveryReportStatus.SUBMITTED);
    const reportId: string = createRes.body.data.id;
    createdReportIds.push(reportId);

    // Approve it.
    const approveRes = await auth(adminToken)('patch', `/v1/delivery-reports/${reportId}/approve`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe(DeliveryReportStatus.APPROVED);

    // Report: APPROVED + reviewer stamped.
    const report = await prisma.deliveryReport.findUniqueOrThrow({
      where: { id: reportId },
      select: { status: true, reviewedByUserId: true, reviewedAt: true },
    });
    expect(report.status).toBe(DeliveryReportStatus.APPROVED);
    expect(report.reviewedByUserId).toBe(adminUserId);
    expect(report.reviewedAt).not.toBeNull();

    // PO lines: quantityDelivered bumped by the per-line delta (A=10, B=5).
    const lineA = await prisma.poLineItem.findUniqueOrThrow({
      where: { id: lineAId },
      select: { quantityDelivered: true },
    });
    const lineB = await prisma.poLineItem.findUniqueOrThrow({
      where: { id: lineBId },
      select: { quantityDelivered: true },
    });
    expect(lineA.quantityDelivered).toBe(10);
    expect(lineB.quantityDelivered).toBe(5);

    // PO status advanced: line A fully delivered (10≥10) but line B partial
    // (5<8) → PARTIALLY_DELIVERED.
    const po = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: poId },
      select: { status: true },
    });
    expect(po.status).toBe(PoStatus.PARTIALLY_DELIVERED);

    // Inventory rose by exactly the same per-line delta.
    expect(await onHand(materialAId)).toBe(beforeA + 10);
    expect(await onHand(materialBId)).toBe(beforeB + 5);
  });

  it('approving every line in full advances the PO to DELIVERED', async () => {
    const { poId, lineAId, lineBId } = await seedDeliverablePo(
      PoStatus.ACCEPTED,
      { materialId: materialAId, quantityOrdered: 4 },
      { materialId: materialBId, quantityOrdered: 6 },
    );

    const beforeA = await onHand(materialAId);
    const beforeB = await onHand(materialBId);

    const createRes = await auth(adminToken)('post', '/v1/delivery-reports').send({
      purchaseOrderId: poId,
      lines: [
        { poLineItemId: lineAId, quantityReceived: 4, outcome: DeliveryOutcome.DELIVERED },
        { poLineItemId: lineBId, quantityReceived: 6, outcome: DeliveryOutcome.DELIVERED },
      ],
    });
    expect(createRes.status).toBe(201);
    const reportId: string = createRes.body.data.id;
    createdReportIds.push(reportId);

    const approveRes = await auth(adminToken)('patch', `/v1/delivery-reports/${reportId}/approve`);
    expect(approveRes.status).toBe(200);

    const po = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: poId },
      select: { status: true },
    });
    expect(po.status).toBe(PoStatus.DELIVERED);

    expect(await onHand(materialAId)).toBe(beforeA + 4);
    expect(await onHand(materialBId)).toBe(beforeB + 6);
  });

  it('rejecting a delivery report leaves the PO and inventory untouched', async () => {
    const { poId, lineAId, lineBId } = await seedDeliverablePo(
      PoStatus.ACCEPTED,
      { materialId: materialAId, quantityOrdered: 5 },
      { materialId: materialBId, quantityOrdered: 5 },
    );

    const beforeA = await onHand(materialAId);
    const beforeB = await onHand(materialBId);
    const beforeStatus = (
      await prisma.purchaseOrder.findUniqueOrThrow({
        where: { id: poId },
        select: { status: true },
      })
    ).status;

    const createRes = await auth(adminToken)('post', '/v1/delivery-reports').send({
      purchaseOrderId: poId,
      lines: [
        { poLineItemId: lineAId, quantityReceived: 5, outcome: DeliveryOutcome.DELIVERED },
        { poLineItemId: lineBId, quantityReceived: 5, outcome: DeliveryOutcome.DELIVERED },
      ],
    });
    expect(createRes.status).toBe(201);
    const reportId: string = createRes.body.data.id;
    createdReportIds.push(reportId);

    const rejectRes = await auth(adminToken)(
      'patch',
      `/v1/delivery-reports/${reportId}/reject`,
    ).send({ reason: 'Wrong items delivered' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe(DeliveryReportStatus.REJECTED);

    // Report: REJECTED + reason stored.
    const report = await prisma.deliveryReport.findUniqueOrThrow({
      where: { id: reportId },
      select: { status: true, rejectionReason: true },
    });
    expect(report.status).toBe(DeliveryReportStatus.REJECTED);
    expect(report.rejectionReason).toBe('Wrong items delivered');

    // PO status + line quantities unchanged.
    const po = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: poId },
      select: { status: true },
    });
    expect(po.status).toBe(beforeStatus);
    const lineA = await prisma.poLineItem.findUniqueOrThrow({
      where: { id: lineAId },
      select: { quantityDelivered: true },
    });
    const lineB = await prisma.poLineItem.findUniqueOrThrow({
      where: { id: lineBId },
      select: { quantityDelivered: true },
    });
    expect(lineA.quantityDelivered).toBe(0);
    expect(lineB.quantityDelivered).toBe(0);

    // Inventory unchanged.
    expect(await onHand(materialAId)).toBe(beforeA);
    expect(await onHand(materialBId)).toBe(beforeB);
  });
});
