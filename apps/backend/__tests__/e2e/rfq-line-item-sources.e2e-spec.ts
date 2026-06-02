import type { INestApplication } from '@nestjs/common';

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
 * FOR-204 — RFQ line items from the catalog AND from a parsed BOM.
 *
 * Proves end-to-end that an RFQ can be created with line items from both
 * sources and that they normalize to a single persisted schema:
 *   • a catalog line keeps its materialId; its name is read from the Material.
 *   • a BOM line keeps a free-text materialName and has no materialId.
 */
describe('RFQ line-item sources (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let admin: AuthTokens;

  let createdVendorId: string;
  let rfqId: string;

  beforeAll(async () => {
    const ctx = await bootstrapTestApp();
    app = ctx.app;
    prisma = ctx.prisma;

    admin = await loginUser(SEED_USERS.companyAdmin.email, SEED_USERS.companyAdmin.password);
  });

  afterAll(async () => {
    if (rfqId) {
      await prisma.rfqVendor.deleteMany({ where: { rfqId } });
      await prisma.rfqLineItem.deleteMany({ where: { rfqId } });
      await prisma.rfq.delete({ where: { id: rfqId } }).catch(() => undefined);
    }
    if (createdVendorId) {
      await prisma.companyVendorAssignment.deleteMany({ where: { vendorId: createdVendorId } });
      await prisma.company.delete({ where: { id: createdVendorId } }).catch(() => undefined);
    }
    await teardownTestApp();
  });

  it('creates an RFQ with one catalog item and one BOM item, normalized to one schema', async () => {
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

    // A real catalog material — the catalog-sourced line references it by id.
    const material = await prisma.material.findFirst({ select: { id: true, name: true } });
    expect(material).not.toBeNull();

    // A vendor assigned to TestCo (POST /companies assigns it to the contractor).
    const stamp = Date.now();
    const vendorRes = await authRequest('post', '/v1/companies', admin.accessToken)
      .send({
        type: 'VENDOR',
        legalName: `BOM Source Vendor ${stamp}`,
        contactEmail: `vendor-${stamp}@for204.local`,
      })
      .expect(201);
    createdVendorId = vendorRes.body.data.id;

    const bomName = 'Galvanised Steel Stud 92mm (BOM)';

    // Create the RFQ with one CATALOG line and one BOM line.
    const createRes = await authRequest('post', '/v1/rfqs', admin.accessToken)
      .send({
        projectId: project!.id,
        deliveryLocationId,
        deadlineEnd: '2026-12-01',
        vendorIds: [createdVendorId],
        lineItems: [
          { source: 'CATALOG', materialId: material!.id, quantity: 7, uom: 'pcs', costCode: 'CC-204' },
          { source: 'BOM', materialName: bomName, quantity: 12, uom: 'ea', notes: 'from parsed BOM' },
        ],
      })
      .expect(201);
    rfqId = createRes.body.data.id;
    expect(rfqId).toBeTruthy();

    // Persisted rows: both sources stored in the single RfqLineItem schema.
    const rows = await prisma.rfqLineItem.findMany({
      where: { rfqId },
      select: { materialId: true, materialName: true, quantity: true, unit: true },
      orderBy: { quantity: 'asc' },
    });
    expect(rows).toHaveLength(2);

    const catalogRow = rows.find((r) => r.materialId !== null);
    const bomRow = rows.find((r) => r.materialId === null);

    expect(catalogRow).toBeDefined();
    expect(catalogRow!.materialId).toBe(material!.id);
    expect(catalogRow!.materialName).toBeNull(); // name lives on the Material

    expect(bomRow).toBeDefined();
    expect(bomRow!.materialId).toBeNull();
    expect(bomRow!.materialName).toBe(bomName);
    expect(bomRow!.unit).toBe('ea');

    // The detail response resolves a display name for BOTH sources.
    const detailRes = await authRequest('get', `/v1/rfqs/${rfqId}`, admin.accessToken).expect(200);
    const names: string[] = detailRes.body.data.lineItems.map(
      (li: { materialName: string }) => li.materialName,
    );
    expect(names).toContain(material!.name);
    expect(names).toContain(bomName);
  });

  it('rejects a line item that has neither a catalog material nor a name', async () => {
    const contractor = await prisma.company.findFirst({
      where: { abn: 'TEST-CONTRACTOR-001' },
      select: { id: true },
    });
    const project = await prisma.project.findFirst({
      where: { companyId: contractor!.id, locations: { some: { type: 'DELIVERY' } } },
      select: {
        id: true,
        locations: { where: { type: 'DELIVERY' }, select: { id: true }, take: 1 },
      },
    });
    const deliveryLocationId = project!.locations[0]!.id;

    await authRequest('post', '/v1/rfqs', admin.accessToken)
      .send({
        projectId: project!.id,
        deliveryLocationId,
        deadlineEnd: '2026-12-01',
        vendorIds: [createdVendorId],
        lineItems: [{ quantity: 1, uom: 'ea' }],
      })
      .expect(400);
  });
});
