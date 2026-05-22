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
 * FOR-197: a vendor that serves multiple contractors is a SINGLE Company row
 * with multiple CompanyVendorAssignment rows pointing at it. This e2e proves
 * the de-dup path end-to-end through the HTTP layer.
 */
describe('Vendors M:N (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let testCoAdmin: AuthTokens;
  let northsideAdmin: AuthTokens;

  beforeAll(async () => {
    const ctx = await bootstrapTestApp();
    app = ctx.app;
    prisma = ctx.prisma;

    testCoAdmin = await loginUser(SEED_USERS.companyAdmin.email, SEED_USERS.companyAdmin.password);
    northsideAdmin = await loginUser(
      SEED_USERS.northsideAdmin.email,
      SEED_USERS.northsideAdmin.password,
    );
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  it('reuses an existing vendor when a second contractor creates the same company', async () => {
    const sharedEmail = `shared-${Date.now()}@m-to-n.local`;

    const first = await authRequest('post', '/v1/companies', testCoAdmin.accessToken)
      .send({
        type: 'VENDOR',
        legalName: 'Shared Vendor Co',
        contactEmail: sharedEmail,
      })
      .expect(201);

    const second = await authRequest('post', '/v1/companies', northsideAdmin.accessToken)
      .send({
        type: 'VENDOR',
        legalName: 'Shared Vendor Co',
        contactEmail: sharedEmail,
      })
      .expect(201);

    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.data.alreadyExisted).toBe(true);

    const rows = await prisma.company.count({
      where: { type: 'VENDOR', contactEmail: sharedEmail },
    });
    expect(rows).toBe(1);

    const assignments = await prisma.companyVendorAssignment.findMany({
      where: { vendorId: first.body.data.id },
      select: { contractorId: true },
    });
    const contractorIds = assignments.map((a) => a.contractorId).sort();
    expect(contractorIds).toHaveLength(2);
    expect(new Set(contractorIds).size).toBe(2);

    await prisma.companyVendorAssignment.deleteMany({ where: { vendorId: first.body.data.id } });
    await prisma.company.delete({ where: { id: first.body.data.id } });
  });

  it('the same Rexel vendor row appears in both contractors’ vendor lists', async () => {
    const rexel = await prisma.company.findFirst({
      where: { contactEmail: 'orders@rexel.local', type: 'VENDOR' },
      select: { id: true },
    });
    expect(rexel).not.toBeNull();

    const testCoList = await authRequest('get', '/v1/vendors', testCoAdmin.accessToken).expect(200);
    const northsideList = await authRequest(
      'get',
      '/v1/vendors',
      northsideAdmin.accessToken,
    ).expect(200);

    const testCoVendorIds = (testCoList.body.data.items as Array<{ companyId: string }>).map(
      (v) => v.companyId,
    );
    const northsideVendorIds = (northsideList.body.data.items as Array<{ companyId: string }>).map(
      (v) => v.companyId,
    );

    expect(testCoVendorIds).toContain(rexel!.id);
    expect(northsideVendorIds).toContain(rexel!.id);
  });

  it('vendor that exists on the platform but is not assigned to this contractor cannot be invited to an RFQ', async () => {
    // Find a vendor assigned ONLY to TestCo (e.g., the seeded Test Vendor Pty Ltd)
    const onlyTestCoVendor = await prisma.company.findFirst({
      where: { contactEmail: 'admin@testvendor.local', type: 'VENDOR' },
      select: { id: true },
    });
    expect(onlyTestCoVendor).not.toBeNull();

    const northsideCompany = await prisma.company.findFirst({
      where: { abn: 'TEST-CONTRACTOR-002' },
      select: { id: true },
    });
    expect(northsideCompany).not.toBeNull();

    const isAssignedToNorthside = await prisma.companyVendorAssignment.findFirst({
      where: { vendorId: onlyTestCoVendor!.id, contractorId: northsideCompany!.id },
    });
    expect(isAssignedToNorthside).toBeNull();

    const project = await prisma.project.findFirst({
      where: { companyId: northsideCompany!.id, name: 'Riverside Apartments' },
      select: {
        id: true,
        locations: { where: { isDefault: true, type: 'DELIVERY' }, select: { id: true } },
      },
    });
    expect(project).not.toBeNull();

    const material = await prisma.material.findFirst({ select: { id: true } });
    expect(material).not.toBeNull();

    const res = await authRequest('post', '/v1/rfqs', northsideAdmin.accessToken).send({
      projectId: project!.id,
      deliveryLocationId: project!.locations[0]?.id,
      deadlineEnd: '2026-07-01',
      vendorIds: [onlyTestCoVendor!.id],
      lineItems: [
        {
          materialId: material!.id,
          quantity: 5,
          uom: 'pcs',
          costCode: 'CC-001',
        },
      ],
    });

    expect(res.status).toBe(400);
    void app;
  });
});
