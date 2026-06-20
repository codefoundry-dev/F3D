import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ApprovalStatus,
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
 * FOR-210 — approval-gated sending of purchase orders.
 *
 * Acceptance criterion under test:
 *   "PO under threshold sends directly; PO over threshold submits for approval."
 *
 * The send action is `POST /v1/purchase-orders/:id/issue`. The backend gates on
 * the caller's `po.approve` threshold (FOR-196 infra): within threshold →
 * DRAFT→SENT; over threshold (or no self-approval grant) → DRAFT→PENDING_APPROVAL
 * with approvalStatus PENDING. SUPER_ADMIN always sends directly.
 *
 * Strategy: spin up the real Nest app, mint JWTs directly to bypass OTP, set the
 * PROCUREMENT_OFFICER `po.approve` threshold to $25k at the DB layer (snapshot +
 * restore), seed Draft POs at $10k (under) and $30k (over), and exercise the
 * issue route as that officer.
 */
describe('PO send-gate threshold enforcement (FOR-210, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  let contractorId: string;
  let projectId: string;
  let locationId: string;
  let caUserId: string;
  let poUserId: string;
  let poToken: string;
  let poApprovePermissionId: string;
  let originalPoThreshold: { hadRow: boolean; threshold: unknown };

  const THRESHOLD = 25_000;

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
    const sequence = `${Date.now()}${Math.round(totalAmount)}`.slice(-8);
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-SEND-${sequence}`,
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
            description: 'Send-gate test line item',
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
    const po = await ensureUser({
      email: 'send-gate-po@testcontractor.local',
      role: UserRole.PROCUREMENT_OFFICER,
      companyId: contractorId,
    });
    caUserId = ca.id;
    poUserId = po.id;
    poToken = await mintToken(po);

    // Ensure PROCUREMENT_OFFICER has po.approve granted, snapshot its threshold,
    // then pin it to $25k so the gate is deterministic.
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
    originalPoThreshold = grant
      ? { hadRow: true, threshold: grant.thresholdAmount }
      : { hadRow: false, threshold: null };

    await prisma.rolePermission.upsert({
      where: {
        role_permissionId: {
          role: UserRole.PROCUREMENT_OFFICER,
          permissionId: poApprovePermissionId,
        },
      },
      update: { thresholdAmount: THRESHOLD },
      create: {
        role: UserRole.PROCUREMENT_OFFICER,
        permissionId: poApprovePermissionId,
        thresholdAmount: THRESHOLD,
      },
    });

    // Pick or create a project + delivery location for the test POs.
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
          label: 'FOR-210 test location',
          address: 'Test address',
          isDefault: true,
        },
      });
      locationId = loc.id;
    } else {
      const created = await prisma.project.create({
        data: {
          name: `FOR-210 send-gate test ${Date.now()}`,
          status: ProjectStatus.ONGOING,
          companyId: contractorId,
          createdByUserId: caUserId,
          locations: {
            create: {
              type: LocationType.DELIVERY,
              label: 'FOR-210 test location',
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
    }

    await app.close();
  });

  const issue = (token: string, poId: string) =>
    request(app.getHttpServer())
      .post(`/v1/purchase-orders/${poId}/issue`)
      .set('Authorization', `Bearer ${token}`);

  it('sends a PO whose total is within the threshold directly (DRAFT → SENT)', async () => {
    const poId = await createDraftPo(10_000);

    const res = await issue(poToken, poId);
    expect([200, 201]).toContain(res.status);

    const after = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { status: true, approvalStatus: true, issuedAt: true },
    });
    expect(after?.status).toBe(PoStatus.SENT);
    expect(after?.issuedAt).not.toBeNull();
  });

  it('routes a PO whose total exceeds the threshold to approval (DRAFT → PENDING_APPROVAL)', async () => {
    const poId = await createDraftPo(30_000);

    const res = await issue(poToken, poId);
    expect([200, 201]).toContain(res.status);

    const after = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { status: true, approvalStatus: true, issuedAt: true },
    });
    expect(after?.status).toBe(PoStatus.PENDING_APPROVAL);
    expect(after?.approvalStatus).toBe(ApprovalStatus.PENDING);
    // Not yet issued to the vendor — issuedAt stays null until approval.
    expect(after?.issuedAt).toBeNull();
  });

  it('exposes the caller approval threshold on GET /v1/users/me for the UI gate', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${poToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.poApprovalThreshold).toBe(THRESHOLD);
  });
});
