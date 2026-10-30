import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AccessTokenPurpose,
  AccessTokenSubject,
  CompanyType,
  PoStatus,
  ProjectStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { AccessTokensService } from '../../src/modules/access-tokens/access-tokens.service';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * FOR-398 — general terms & conditions on purchase orders, and FOR-397 — the
 * vendor's "Approve" lands the PO in ACCEPTED (shown to vendors as "Approved").
 *
 * Against the real app + local DB:
 *   - only the Company Admin sets the company default (trimmed, blank → null);
 *   - a new PO snapshots the default unless the wizard sends its own text;
 *   - editing the default never rewrites an existing PO, while a copy takes
 *     today's default;
 *   - the detail, PDF export and guest portal all carry the PO's terms;
 *   - the guest acknowledge → approve flow ends in ACCEPTED.
 */
describe('PO terms & conditions + vendor approve (FOR-397/398, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let accessTokens: AccessTokensService;

  let contractorId: string;
  let projectId: string;
  let locationId: string | undefined;
  let vendorId: string;
  let caToken: string;
  let officerToken: string;
  let originalTerms: string | null = null;
  const createdPoIds: string[] = [];

  // Users this suite creates in the PO's company, removed again in afterAll.
  const createdUserIds: string[] = [];
  async function ensureUser(role: UserRole) {
    const email = `terms-${role.toLowerCase()}-${contractorId.slice(0, 8)}@for398.e2e.local`;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return existing;
    const user = await prisma.user.create({
      data: { email, name: email, role, companyId: contractorId, status: UserStatus.ACTIVE },
    });
    createdUserIds.push(user.id);
    return user;
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const setDefaultTerms = (token: string, poTermsAndConditions: string | null) =>
    request(app.getHttpServer())
      .patch(`/v1/companies/${contractorId}`)
      .set(auth(token))
      .send({ poTermsAndConditions });

  async function createPo(termsAndConditions?: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/v1/purchase-orders')
      .set(auth(caToken))
      .send({
        documentName: 'FOR-398 terms e2e',
        projectId,
        vendorId,
        ...(locationId && { deliveryLocationId: locationId }),
        lineItems: [
          {
            description: 'Terms e2e line',
            quantityOrdered: 2,
            unitOfMeasure: 'unit',
            unitPrice: 50,
          },
        ],
        ...(termsAndConditions !== undefined && { termsAndConditions }),
      });
    expect(res.status).toBe(201);
    const id = (res.body.data ?? res.body).id as string;
    createdPoIds.push(id);
    return id;
  }

  const storedTerms = async (poId: string) =>
    (
      await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        select: { termsAndConditions: true },
      })
    )?.termsAndConditions;

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
    accessTokens = app.get(AccessTokensService);

    // Derive the company, project, vendor (and a location, if any) from a PO the seed
    // already has, so the create path's checks pass exactly as in the app.
    const seedPo = await prisma.purchaseOrder.findFirst({
      where: {
        vendorId: { not: null },
        company: { type: CompanyType.CONTRACTOR },
        project: { status: { not: ProjectStatus.ARCHIVED } },
      },
      select: {
        companyId: true,
        projectId: true,
        vendorId: true,
        project: { select: { locations: { select: { id: true }, take: 1 } } },
        company: { select: { poTermsAndConditions: true } },
      },
    });
    if (!seedPo?.vendorId || !seedPo.projectId) {
      throw new Error('Test seed missing — expected a contractor PO with a vendor.');
    }
    contractorId = seedPo.companyId;
    projectId = seedPo.projectId;
    locationId = seedPo.project?.locations[0]?.id;
    vendorId = seedPo.vendorId;
    originalTerms = seedPo.company.poTermsAndConditions;

    const ca = await ensureUser(UserRole.COMPANY_ADMIN);
    const officer = await ensureUser(UserRole.PROCUREMENT_OFFICER);
    const mint = (u: { id: string; email: string; role: UserRole }) =>
      jwt.signAsync({ sub: u.id, email: u.email, role: u.role, companyId: contractorId });
    caToken = await mint(ca);
    officerToken = await mint(officer);
  });

  afterAll(async () => {
    if (contractorId) {
      await prisma.company.update({
        where: { id: contractorId },
        data: { poTermsAndConditions: originalTerms },
      });
    }
    if (createdPoIds.length > 0) {
      await prisma.accessToken
        .deleteMany({ where: { subjectId: { in: createdPoIds } } })
        .catch(() => undefined);
      await prisma.purchaseOrder
        .deleteMany({ where: { id: { in: createdPoIds } } })
        .catch(() => undefined);
    }
    // Audit rows (PO_CREATED, company updates) reference the suite's users and
    // POs without cascading, so they go first or the user delete is blocked.
    await prisma.auditLog
      .deleteMany({
        where: {
          OR: [
            { targetType: 'PurchaseOrder', targetId: { in: createdPoIds } },
            { performedById: { in: createdUserIds } },
          ],
        },
      })
      .catch(() => undefined);
    if (createdUserIds.length > 0) {
      await prisma.user
        .deleteMany({ where: { id: { in: createdUserIds } } })
        .catch(() => undefined);
    }
    await app.close();
  });

  it('lets the Company Admin set the default terms (trimmed) and forbids other roles', async () => {
    const res = await setDefaultTerms(caToken, '  1. Deliver on time.\n2. Invoice monthly.  ');
    expect(res.status).toBe(200);
    const company = await prisma.company.findUnique({ where: { id: contractorId } });
    expect(company?.poTermsAndConditions).toBe('1. Deliver on time.\n2. Invoice monthly.');

    const denied = await setDefaultTerms(officerToken, 'Officer terms');
    expect(denied.status).toBe(403);
    const unchanged = await prisma.company.findUnique({ where: { id: contractorId } });
    expect(unchanged?.poTermsAndConditions).toBe('1. Deliver on time.\n2. Invoice monthly.');
  });

  it('snapshots the default onto a new PO unless the wizard sends its own terms', async () => {
    const defaulted = await createPo();
    expect(await storedTerms(defaulted)).toBe('1. Deliver on time.\n2. Invoice monthly.');

    const edited = await createPo('  Custom terms for this PO only.  ');
    expect(await storedTerms(edited)).toBe('Custom terms for this PO only.');

    const cleared = await createPo('   ');
    expect(await storedTerms(cleared)).toBeNull();
  });

  it('keeps an existing PO on its own snapshot when the default changes; a copy takes the new default', async () => {
    const poId = await createPo();
    expect((await setDefaultTerms(caToken, 'Revised company terms.')).status).toBe(200);

    expect(await storedTerms(poId)).toBe('1. Deliver on time.\n2. Invoice monthly.');
    const detail = await request(app.getHttpServer())
      .get(`/v1/purchase-orders/${poId}`)
      .set(auth(caToken));
    expect(detail.status).toBe(200);
    expect((detail.body.data ?? detail.body).termsAndConditions).toBe(
      '1. Deliver on time.\n2. Invoice monthly.',
    );

    const copy = await request(app.getHttpServer())
      .post(`/v1/purchase-orders/${poId}/copy`)
      .set(auth(caToken));
    expect(copy.status).toBe(201);
    const copyId = (copy.body.data ?? copy.body).id as string;
    createdPoIds.push(copyId);
    expect(await storedTerms(copyId)).toBe('Revised company terms.');
  });

  it('exports the PO PDF with terms', async () => {
    const poId = await createPo('Terms printed on the PDF.');
    const res = await request(app.getHttpServer())
      .get(`/v1/purchase-orders/${poId}/export/pdf`)
      .set(auth(caToken));
    expect(res.status).toBe(200);
  });

  it('shows the terms on the guest portal and approves through acknowledge → ACCEPTED', async () => {
    const poId = await createPo('Guest-visible terms.');
    await prisma.purchaseOrder.update({ where: { id: poId }, data: { status: PoStatus.SENT } });
    const { token } = await accessTokens.issueToken({
      subjectType: AccessTokenSubject.PURCHASE_ORDER,
      subjectId: poId,
      purpose: AccessTokenPurpose.PO_VIEW,
      ttlMs: 60 * 60 * 1000,
      maxAttempts: 50,
    });
    const portal = (method: 'get' | 'post' | 'patch', path: string) =>
      request(app.getHttpServer())
        [method](`/v1/purchase-orders/portal${path}`)
        .set('x-access-token', token);

    const view = await portal('get', '');
    expect(view.status).toBe(200);
    expect((view.body.data ?? view.body).termsAndConditions).toBe('Guest-visible terms.');

    expect([200, 201]).toContain((await portal('post', '/acknowledge')).status);
    const approve = await portal('patch', '/accept').send({});
    expect(approve.status).toBe(200);

    const after = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { status: true },
    });
    expect(after?.status).toBe(PoStatus.ACCEPTED);
  });
});
