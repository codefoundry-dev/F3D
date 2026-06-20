import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CompanyType,
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
 * FOR-196 — threshold-aware approval of purchase orders.
 *
 * Acceptance criterion under test:
 *   "Junior officer cannot approve $30k PO, senior officer can."
 *
 * Strategy: spin up the real Nest app, mint JWTs directly to bypass OTP,
 * seed a Draft PO with totalAmount = $30,000 at the database layer, then
 * exercise the `PATCH /v1/purchase-orders/:id/approve` route as two callers
 * whose roles carry different thresholds for `po.approve`.
 */
describe('PO approval threshold enforcement (FOR-196, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  let contractorId: string;
  let projectId: string;
  let locationId: string;
  let caUserId: string;
  let poUserId: string;
  let caToken: string;
  let poToken: string;
  let poApprovePermissionId: string;
  let originalPoThreshold: { hadRow: boolean; threshold: unknown };
  let originalCaApproveGrant: { hadRow: boolean; threshold: unknown } | undefined;

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

  async function ensureUser(opts: {
    email: string;
    role: UserRole;
    companyId: string;
  }): Promise<{ id: string; email: string; role: UserRole; companyId: string | null }> {
    const existing = await prisma.user.findUnique({ where: { email: opts.email } });
    if (existing) {
      if (existing.status !== UserStatus.ACTIVE) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { status: UserStatus.ACTIVE },
        });
      }
      return {
        id: existing.id,
        email: existing.email,
        role: existing.role,
        companyId: existing.companyId,
      };
    }
    return prisma.user.create({
      data: {
        email: opts.email,
        name: opts.email,
        role: opts.role,
        companyId: opts.companyId,
        status: UserStatus.ACTIVE,
      },
      select: { id: true, email: true, role: true, companyId: true },
    });
  }

  async function createDraftPo(totalAmount: number): Promise<string> {
    const sequence = Date.now().toString().slice(-8);
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-THRESH-${sequence}`,
        companyId: contractorId,
        projectId,
        deliveryLocationId: locationId,
        createdByUserId: caUserId,
        status: PoStatus.DRAFT,
        currency: 'AUD',
        subtotal: totalAmount,
        totalAmount,
        lineItemCount: 1,
        totalRequestedQty: 1,
        lineItems: {
          create: {
            lineNumber: 1,
            quantityOrdered: 1,
            unitOfMeasure: 'unit',
            unitPrice: totalAmount,
            lineTotal: totalAmount,
            description: 'Threshold test line item',
          },
        },
      },
      select: { id: true },
    });
    return po.id;
  }

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

    const contractor = await prisma.company.findFirst({ where: { type: CompanyType.CONTRACTOR } });
    if (!contractor) {
      throw new Error('Test seed missing — expected at least one CONTRACTOR company.');
    }
    contractorId = contractor.id;

    const ca = await ensureUser({
      email: 'companyadmin@testcontractor.local',
      role: UserRole.COMPANY_ADMIN,
      companyId: contractorId,
    });
    // The seed Company Admin already belongs to a contractor. Align the whole
    // fixture (the test PO + the junior PROCUREMENT_OFFICER) to THAT company so
    // the senior-approver case isn't rejected by the company-scope guard when the
    // findFirst() above happens to return a different contractor than the CA's.
    contractorId = ca.companyId ?? contractorId;
    const po = await ensureUser({
      email: 'threshold-po@testcontractor.local',
      role: UserRole.PROCUREMENT_OFFICER,
      companyId: contractorId,
    });
    // ensureUser keeps an existing user's company; a stale threshold-po from an
    // earlier run could sit in a different contractor. Re-home it into the aligned
    // company so its approvals pass the company-scope guard.
    if (po.companyId !== contractorId) {
      await prisma.user.update({ where: { id: po.id }, data: { companyId: contractorId } });
      po.companyId = contractorId;
    }
    caUserId = ca.id;
    poUserId = po.id;
    caToken = await mintToken(ca);
    poToken = await mintToken(po);

    // Make sure the PROCUREMENT_OFFICER actually has po.approve granted, and
    // snapshot its threshold so we can restore it after the suite.
    const permission = await prisma.permission.findUnique({ where: { key: 'po.approve' } });
    if (!permission) {
      throw new Error('Catalog row missing — expected po.approve permission to be bootstrapped.');
    }
    poApprovePermissionId = permission.id;
    const grant = await prisma.rolePermission.findUnique({
      where: {
        role_permissionId: {
          role: UserRole.PROCUREMENT_OFFICER,
          permissionId: poApprovePermissionId,
        },
      },
    });
    if (grant) {
      originalPoThreshold = { hadRow: true, threshold: grant.thresholdAmount };
    } else {
      originalPoThreshold = { hadRow: false, threshold: null };
      await prisma.rolePermission.create({
        data: {
          role: UserRole.PROCUREMENT_OFFICER,
          permissionId: poApprovePermissionId,
          thresholdAmount: null,
        },
      });
    }

    // Ensure COMPANY_ADMIN holds po.approve with an unlimited (null) threshold so
    // the "senior approver" case is self-contained — the dev seed does not
    // reliably materialise every catalog grant (same reason the block above
    // provisions PROCUREMENT_OFFICER). Snapshot so afterAll can restore it.
    const caGrant = await prisma.rolePermission.findUnique({
      where: {
        role_permissionId: {
          role: UserRole.COMPANY_ADMIN,
          permissionId: poApprovePermissionId,
        },
      },
    });
    if (caGrant) {
      originalCaApproveGrant = { hadRow: true, threshold: caGrant.thresholdAmount };
      if (caGrant.thresholdAmount !== null) {
        await prisma.rolePermission.update({
          where: {
            role_permissionId: {
              role: UserRole.COMPANY_ADMIN,
              permissionId: poApprovePermissionId,
            },
          },
          data: { thresholdAmount: null },
        });
      }
    } else {
      originalCaApproveGrant = { hadRow: false, threshold: null };
      await prisma.rolePermission.create({
        data: {
          role: UserRole.COMPANY_ADMIN,
          permissionId: poApprovePermissionId,
          thresholdAmount: null,
        },
      });
    }

    // Pick or create a project + location for the test PO
    const project = await prisma.project.findFirst({
      where: { companyId: contractorId, status: { not: ProjectStatus.ARCHIVED } },
      include: { locations: true },
    });
    if (project && project.locations.length > 0) {
      projectId = project.id;
      locationId = project.locations[0].id;
    } else if (project) {
      projectId = project.id;
      const loc = await prisma.projectLocation.create({
        data: {
          projectId,
          type: LocationType.DELIVERY,
          label: 'FOR-196 test location',
          address: 'Test address',
          isDefault: true,
        },
      });
      locationId = loc.id;
    } else {
      const created = await prisma.project.create({
        data: {
          name: `FOR-196 threshold test ${Date.now()}`,
          status: ProjectStatus.ONGOING,
          companyId: contractorId,
          createdByUserId: caUserId,
          locations: {
            create: {
              type: LocationType.DELIVERY,
              label: 'FOR-196 test location',
              address: 'Test address',
              isDefault: true,
            },
          },
        },
        include: { locations: true },
      });
      projectId = created.id;
      locationId = created.locations[0].id;
    }
  });

  afterAll(async () => {
    // Restore the original threshold on PROCUREMENT_OFFICER.po.approve so we
    // don't leave persistent state in the shared dev DB.
    if (poApprovePermissionId) {
      if (originalPoThreshold.hadRow) {
        await prisma.rolePermission.update({
          where: {
            role_permissionId: {
              role: UserRole.PROCUREMENT_OFFICER,
              permissionId: poApprovePermissionId,
            },
          },
          data: { thresholdAmount: originalPoThreshold.threshold as never },
        });
      } else {
        await prisma.rolePermission
          .delete({
            where: {
              role_permissionId: {
                role: UserRole.PROCUREMENT_OFFICER,
                permissionId: poApprovePermissionId,
              },
            },
          })
          .catch(() => undefined);
      }

      // Restore COMPANY_ADMIN's po.approve grant to its pre-test state.
      if (originalCaApproveGrant) {
        if (originalCaApproveGrant.hadRow) {
          await prisma.rolePermission.update({
            where: {
              role_permissionId: {
                role: UserRole.COMPANY_ADMIN,
                permissionId: poApprovePermissionId,
              },
            },
            data: { thresholdAmount: originalCaApproveGrant.threshold as never },
          });
        } else {
          await prisma.rolePermission
            .delete({
              where: {
                role_permissionId: {
                  role: UserRole.COMPANY_ADMIN,
                  permissionId: poApprovePermissionId,
                },
              },
            })
            .catch(() => undefined);
        }
      }
    }

    await app.close();
  });

  const auth = (token: string) => (method: 'get' | 'put' | 'patch' | 'post', url: string) =>
    request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`);

  // NOTE: the approval route is PATCH /v1/purchase-orders/:id/approve.

  it('denies a junior approver whose threshold is below the PO total', async () => {
    // Set junior threshold to $25k via the roles API
    await auth(caToken)('put', '/v1/roles/PROCUREMENT_OFFICER/permissions')
      .send({
        permissionKeys: ['po.approve', 'po.read', 'po.list'],
        thresholds: { 'po.approve': 25_000 },
      })
      .expect(200);

    const poId = await createDraftPo(30_000);

    const res = await auth(poToken)('patch', `/v1/purchase-orders/${poId}/approve`);
    expect(res.status).toBe(403);

    // PO must remain DRAFT (never partially approved)
    const after = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { status: true, approvedById: true },
    });
    expect(after?.status).toBe(PoStatus.DRAFT);
    expect(after?.approvedById).toBeNull();
  });

  it('lets the same junior approver clear a PO whose total is within the threshold', async () => {
    const poId = await createDraftPo(10_000);

    const res = await auth(poToken)('patch', `/v1/purchase-orders/${poId}/approve`);
    expect(res.status).toBe(200);

    const after = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { status: true, approvedById: true },
    });
    expect(after?.status).toBe(PoStatus.ACKNOWLEDGED);
    expect(after?.approvedById).toBe(poUserId);
  });

  it('lets a senior approver (Company Admin, unlimited threshold) approve the $30k PO', async () => {
    // COMPANY_ADMIN's po.approve threshold defaults to null = unlimited.
    const poId = await createDraftPo(30_000);

    const res = await auth(caToken)('patch', `/v1/purchase-orders/${poId}/approve`);
    expect(res.status).toBe(200);

    const after = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { status: true, approvedById: true },
    });
    expect(after?.status).toBe(PoStatus.ACKNOWLEDGED);
    expect(after?.approvedById).toBe(caUserId);
  });
});
